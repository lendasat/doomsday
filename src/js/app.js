import * as bitcoin from "bitcoinjs-lib";
import { Buffer } from "buffer";

import hkdf from "js-crypto-hkdf";
import { siv } from "@noble/ciphers/aes";

import ecc from "./ecc-adapter";

import ECPairFactory from "ecpair";
const ECPair = ECPairFactory(ecc);

import BIP32Factory from "bip32";
const bip32 = BIP32Factory(ecc);

const bip39 = require("bip39");

import { feeEstimates } from "./esplora";
import {
  markInvalid,
  markValid,
  networkFromAddress,
  parseAddress,
} from "./utils.js";

import { nip19 } from "nostr-tools";

const estimatedTxVb = 186;
const targetConfirmationBlocks = 3;
const minimumRelayFee = 200;

// OP_2 <server_pubkey> <seller_pubkey> <buyer_pubkey> OP_3 OP_CHECKMULTISIG
const twoOfThreeWitness =
  /^5221([a-f0-9]{66})21([a-f0-9]{66})21([a-f0-9]{66})53ae$/;

async function decryptSeed(encryptedSeed, passwordString) {
  try {
    const password = Buffer.from(passwordString, "utf-8");

    const parts = encryptedSeed.split("$");
    if (parts.length !== 2) {
      console.error("Invalid mnemonicCiphertext format");
      return Promise.resolve(null);
    }

    const [saltHex, ciphertextHex] = parts;
    const salt = Buffer.from(saltHex, "hex");
    const encryptionKey = await hkdf.compute(
      password,
      "SHA-256",
      32,
      "ENCRYPTION_KEY",
      salt,
    );

    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const nonceBuffer = Buffer.from("SECRET_KEY!!", "utf-8");

    const aesGcmSiv = siv(encryptionKey.key, nonceBuffer);

    const plaintext = aesGcmSiv.decrypt(ciphertext);
    const decoder = new TextDecoder("utf-8");
    let mnemonicString = decoder.decode(plaintext);

    const words = mnemonicString.split(" ");
    let contractSecret;
    if (words.length >= 13) {
      mnemonicString = words.slice(0, 12).join(" ");
      contractSecret = words[12];
    }

    return { mnemonic: mnemonicString, contractSecret: contractSecret };
  } catch (e) {
    console.error("Failed to decrypt mnemonic", e);
    return null;
  }
}

async function derivePrivateKey(mnemonic, passphrase, path) {
  const seed = await bip39.mnemonicToSeed(mnemonic, passphrase);

  const key = bip32
    .fromSeed(Buffer.from(seed, "hex"))
    .derivePath(path)
    .privateKey.toString("hex");

  const pk = bip32
    .fromSeed(Buffer.from(seed, "hex"))
    .derivePath(path)
    .publicKey.toString("hex");

  return { privateKey: key, publicKey: pk };
}

async function deriveNsec(mnemonic, path) {
  const kp = await derivePrivateKey(mnemonic, "", path);

  const skBuffer = Buffer.from(kp.privateKey, "hex");
  const nsec = nip19.nsecEncode(skBuffer);

  return nsec.toString();
}

function validateAddressInput(input, validNetwork) {
  const inputAddress = input.value;
  const addressNetwork =
    input.parentElement.getElementsByClassName("addressNetwork")[0];

  let parsedAddress;
  let parsedNetwork;
  try {
    const { address, network } = parseAddress(inputAddress);
    parsedAddress = address;
    parsedNetwork = network;
  } catch (e) {
    console.log("invalid address", e);
    markInvalid(input);
    return false;
  }

  if (parsedAddress === null || parsedNetwork != validNetwork) {
    markInvalid(input);
    return false;
  }

  addressNetwork.innerText = parsedNetwork;
  markValid(input);
  return true;
}

function validateNumericInput(input) {
  const i = Number(input.value);
  if (isNaN(i) || i.toString() != input.value) {
    markInvalid(input);
    return false;
  }

  markValid(input);
  return i;
}

function parseWitnessScript(script) {
  const result = script.match(twoOfThreeWitness);
  if (!result) {
    return null;
  }

  return result.slice(1);
}

function validateWitnessScript(scriptInput, address) {
  const script = scriptInput.value;
  const publicKeys = parseWitnessScript(script);
  if (!publicKeys) {
    markInvalid(scriptInput);
    return false;
  }

  const addressNetwork = networkFromAddress(address);
  const correctAddress = bitcoin.payments.p2wsh({
    redeem: bitcoin.payments.p2ms({
      m: 2,
      pubkeys: publicKeys.map((x) => Buffer.from(x, "hex")),
      network:
        addressNetwork == "mainnet"
          ? bitcoin.networks.bitcoin
          : bitcoin.networks.testnet,
    }),
  }).address;

  if (address != correctAddress) {
    console.log(`Address should've been ${correctAddress}, but was ${address}`);
    markInvalid(scriptInput);
    return false;
  }

  markValid(scriptInput);
  return publicKeys;
}

async function recommendedFee(network) {
  const result = await feeEstimates(network);
  const variableFee =
    result[targetConfirmationBlocks.toString()] * estimatedTxVb;
  return Math.max(variableFee, minimumRelayFee);
}

function buildSkeletonTx({ collateralAddress, utxos, outputs, witnessScript }) {
  const publicKeys = parseWitnessScript(witnessScript);

  const network =
    networkFromAddress(collateralAddress) == "mainnet"
      ? bitcoin.networks.bitcoin
      : bitcoin.networks.testnet;
  const psbt = new bitcoin.Psbt({ network });
  const payment = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wsh({
      redeem: bitcoin.payments.p2ms({
        m: 2,
        pubkeys: publicKeys.map((x) => Buffer.from(x, "hex")),
        network: network,
      }),
    }),
  });

  utxos.forEach((utxo) => {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      value: utxo.value,
      witnessUtxo: {
        script: Buffer.from(utxo.scriptPubKey, "hex"),
        value: utxo.value,
      },
      witnessScript: payment.redeem.redeem.output,
    });
  });

  outputs.forEach((output) => {
    psbt.addOutput(output);
  });

  return psbt.toHex();
}

const buildPsbt = ({ psbtHex, key, network }) => {
  const psbt = bitcoin.Psbt.fromHex(psbtHex, { network });

  const signer = ECPair.fromPrivateKey(Buffer.from(key, "hex"));
  psbt.signAllInputs(signer);
  return psbt.toHex();
};

const buildTx = ({ psbtHex, network }) => {
  const psbt = bitcoin.Psbt.fromHex(psbtHex, { network });
  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
};

export {
  buildSkeletonTx,
  buildPsbt,
  buildTx,
  deriveNsec,
  derivePrivateKey,
  decryptSeed,
  recommendedFee,
  validateAddressInput,
  validateNumericInput,
  validateWitnessScript,
};

export { broadcast, unspents, txLink } from "./esplora";
