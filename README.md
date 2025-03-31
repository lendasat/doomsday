# Lendasat Doomsday Software

If Lendasat disappears, use this tool to recover your contract funds.

## How to use

To use this you will need to collaborate with your counterparty. To coordinate, you can try to reach them via Nostr using your derived Nsec and your counterparty's derived Npub.

All the required data (other than your password) should be present in your contract backup.

As the _initiating_ party, follow these steps:

1. Open `dist/index.html` in a web browser.
2. Choose your network (mainnet by default).
3. Derive your private key in the contract by filling in:
   - Your encrypted wallet seed.
   - Your Lendasat password.
   - Your contract derivation path.
4. Click on **`Build transaction`**.
5. Provide the spend transaction inputs by filling in:
   - The collateral contract address.
   - The collateral script.
6. Click 'Next'.
7. After discussing with your counterparty, provide the spend transaction outputs:
   - The borrower address and amount.
   - The lender address and amount.
8. Click 'Next'.
9. If a PSBT with your signature is generated correctly, copy the hex output and share it with your counterparty.

As the _finalizing_ party, after receiving their signed PSBT, follow these steps:

1. **Verify the PSBT**. In particular, make sure you get the amount that you expect.
2. Choose your network (mainnet by default).
3. Derive your private key in the contract by filling in:
   - Your encrypted wallet seed.
   - Your Lendasat password.
   - Your contract derivation path.
4. Click on **`Sign & broadcast`**.
5. Paste the **verified** PSBT sent by your counterparty into the corresponding text box.
6. If a signed transaction is generated correctly, click broadcast.

A few seconds later, the transaction should be published to the Bitcoin blockchain.
