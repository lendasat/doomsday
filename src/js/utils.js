import * as bitcoin from "bitcoinjs-lib";

function throttle(callback, limit) {
  var waiting = false;
  return function () {
    if (!waiting) {
      callback.apply(this, arguments);
      waiting = true;
      setTimeout(function () {
        waiting = false;
      }, limit);
    }
  };
}

const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
};

const markValid = (input) => {
  input.classList.remove("is-invalid");
  input.classList.add("is-valid");
};

const markInvalid = (input) => {
  input.classList.remove("is-valid");
  input.classList.add("is-invalid");
};

function networkFromAddress(address) {
  if (address.startsWith("bc1")) {
    new bitcoin.address.fromBech32(address);
    return "mainnet";
  } else if (address.startsWith("tb1")) {
    new bitcoin.address.fromBech32(address);
    return "signet";
  } else {
    throw "unsupported address format";
  }
}

function parseAddress(address) {
  const network = networkFromAddress(address);
  if (!network) {
    return { address, network: null };
  }

  return { address, network };
}

export {
  markInvalid,
  markValid,
  networkFromAddress,
  parseAddress,
  debounce,
  throttle,
};
