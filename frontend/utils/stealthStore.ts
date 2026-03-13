const stealthAddressToRecipient = new Map<string, string>();

export function storeStealthMapping(stealthAddress: string, recipientAddress: string) {
  stealthAddressToRecipient.set(stealthAddress.toLowerCase(), recipientAddress.toLowerCase());
}

export function getMappedRecipient(stealthAddress: string) {
  return stealthAddressToRecipient.get(stealthAddress.toLowerCase()) || null;
}
