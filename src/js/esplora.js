import { networkFromAddress } from "./utils.js";

const mainnetBaseURL = "https://blockstream.info/api";
const signetBaseURL = "https://mutinynet.com/api";

async function tx(txid, network) {
  let baseURL = network == "mainnet" ? mainnetBaseURL : signetBaseURL;
  console.log(`Esplora: fetching ${network} transaction ${txid}`);
  const result = await fetch(`${baseURL}/tx/${encodeURIComponent(txid)}`);
  const json = await result.json();

  return json;
}

async function unspents(address) {
  let network = networkFromAddress(address);
  let baseURL = network == "mainnet" ? mainnetBaseURL : signetBaseURL;
  console.log(`Esplora: fetching ${network} address ${address}`);
  const result = await fetch(
    `${baseURL}/address/${encodeURIComponent(address)}/utxo`,
  );
  const json = await result.json();
  const promises = json.map(async (input) => {
    const inputTx = await tx(input.txid, network);
    return {
      txid: input.txid,
      vout: input.vout,
      value: input.value,
      scriptPubKey: inputTx.vout[input.vout].scriptpubkey,
    };
  });
  return await Promise.all(promises);
}

async function feeEstimates(network) {
  let baseURL = network == "mainnet" ? mainnetBaseURL : signetBaseURL;
  const result = await fetch(`${baseURL}/fee-estimates`);
  const json = await result.json();
  return json;
}

async function broadcast(tx, network) {
  let baseURL = network == "mainnet" ? mainnetBaseURL : signetBaseURL;
  console.log(`Esplora: posting ${network} transaction ${tx}`);
  const result = await fetch(`${baseURL}/tx`, { method: "POST", body: tx });
  if (!result.ok) {
    console.log("Posting transaction failed", result);
    throw "Posting transaction failed";
  }
  const text = await result.text();
  return text;
}

function txLink(tx, network) {
  return network == "mainnet"
    ? `https://mempool.space/tx/${encodeURIComponent(tx)}`
    : `https://mutinynet.com/tx/${encodeURIComponent(tx)}`;
}

export { broadcast, feeEstimates, txLink, unspents };
