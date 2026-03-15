import { MongoClient, type Collection } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = "brobet";
const COLLECTION_NAME = "ens_profiles";

// Reuse the MongoClient across hot-reloads in Next.js dev mode
declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

async function getClient(): Promise<MongoClient> {
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(MONGODB_URI);
    await global._mongoClient.connect();
  }
  return global._mongoClient;
}

export type ENSProfile = {
  ensName: string;        // lowercase, e.g. "alice.eth"
  ownerAddress: string;   // lowercase wallet address
  token: string;          // "USDC" | "USDT" | "DAI" | "WETH"
  network: string;        // "base" | "arbitrum" | "ethereum"
  dex: string;            // "uniswap" | "aerodrome" | "sushiswap"
  slippage: string;       // "0.5"
  note: string;
  stealth: boolean;
  updatedAt: Date;
  createdAt: Date;
};

async function collection(): Promise<Collection<ENSProfile>> {
  const client = await getClient();
  return client.db(DB_NAME).collection<ENSProfile>(COLLECTION_NAME);
}

export async function upsertProfile(
  data: Omit<ENSProfile, "createdAt" | "updatedAt">
): Promise<void> {
  const col = await collection();
  await col.updateOne(
    { ensName: data.ensName.toLowerCase() },
    {
      $set: {
        ...data,
        ensName: data.ensName.toLowerCase(),
        ownerAddress: data.ownerAddress.toLowerCase(),
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
}

export async function getProfileByENS(ensName: string): Promise<ENSProfile | null> {
  const col = await collection();
  return col.findOne({ ensName: ensName.toLowerCase() });
}

export async function getProfilesByAddress(ownerAddress: string): Promise<ENSProfile[]> {
  const col = await collection();
  return col
    .find({ ownerAddress: ownerAddress.toLowerCase() })
    .sort({ updatedAt: -1 })
    .toArray();
}

export async function deleteProfile(ensName: string, ownerAddress: string): Promise<boolean> {
  const col = await collection();
  const result = await col.deleteOne({
    ensName: ensName.toLowerCase(),
    ownerAddress: ownerAddress.toLowerCase(),
  });
  return result.deletedCount > 0;
}
