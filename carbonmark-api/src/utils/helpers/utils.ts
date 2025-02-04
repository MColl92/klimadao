import { FastifyInstance } from "fastify";
import { compact, concat, isArray } from "lodash";
import { filter, flatten, map, pipe, split, trim, uniq } from "lodash/fp";
import {
  Category,
  Country,
  Listing,
} from "../../.generated/types/marketplace.types";
import { CarbonOffset } from "../../.generated/types/offsets.types";

import { TOKEN_ADDRESSES } from "../../app.constants";
import { extract, notEmptyOrNil } from "../functional.utils";
import { gqlSdk } from "../gqlSdk";
import { CarbonProject } from "./carbonProjects.utils";
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- unable to type environment variables
const ENV = (process.env.VERCEL_ENV ?? "development") as
  | "development"
  | "production";

// This function retrieves all vintages from two different sources (marketplace and carbon offsets),
// combines them, removes duplicates, and returns the result as a sorted array of strings.
export async function getAllVintages(
  fastify: FastifyInstance
): Promise<string[]> {
  const uniqueValues = new Set<string>();
  const cacheKey = `vintages`;
  const cachedResult = await fastify.lcache.get<string[]>(cacheKey)?.payload;

  if (cachedResult) {
    return cachedResult;
  }

  const [{ projects }, { carbonOffsets }] = await Promise.all([
    gqlSdk.marketplace.getVintages(),
    gqlSdk.offsets.getCarbonOffsetsVintages(),
  ]);

  /** Handle invalid responses */
  if (!isArray(projects) || !isArray(carbonOffsets)) {
    throw new Error("Response from server did not match schema definition");
  }

  projects.forEach((item) => uniqueValues.add(item.vintage));
  carbonOffsets.forEach((item) => uniqueValues.add(item.vintageYear));

  const result = Array.from(uniqueValues).sort().filter(notEmptyOrNil);

  await fastify.lcache.set(cacheKey, { payload: result });

  return result;
}

// This function retrieves all categories from two different sources (marketplace and carbon offsets),
// combines them, removes duplicates, and returns the result as an array of objects with an "id" property.
export async function getAllCategories(fastify: FastifyInstance) {
  // Define cache key for caching the result
  const cacheKey = `categories`;
  // Try to get the cached result
  try {
    const cachedResult =
      await fastify.lcache.get<Category[]>(cacheKey)?.payload;

    // If the cached result exists, return it
    if (cachedResult) return cachedResult;
  } catch (error) {
    console.debug(error);
  }

  // Fetch categories from the marketplace & carbon offsets categories
  const [{ categories }, { carbonOffsets }] = await Promise.all([
    gqlSdk.marketplace.getCategories(),
    gqlSdk.offsets.getCarbonOffsetsCategories(),
  ]);

  /** Handle invalid responses */
  if (!isArray(categories) || !isArray(carbonOffsets)) {
    throw new Error("Response from server did not match schema definition");
  }

  // Extract the required values from the fetched data
  const values = [
    categories?.map(extract("id")),
    carbonOffsets?.map(extract("methodologyCategory")),
  ];

  // This function pipeline combines and deduplicates categories from different sources
  // and maps them to objects with an "id" property
  const fn = pipe(
    concat,
    flatten,
    split(","),
    map(trim),
    uniq,
    compact,
    map((id: Category) => ({ id })),
    filter(notEmptyOrNil)
  );

  // Apply the function pipeline to the extracted values
  const result: Category[] = fn(values);

  // Cache the result before returning it
  await fastify.lcache.set(cacheKey, { payload: result });

  // Return the combined and deduplicated categories
  return result;
}

export async function getAllCountries(fastify: FastifyInstance) {
  const cacheKey = `countries`;

  const cachedResult = await fastify.lcache.get<Country[]>(cacheKey)?.payload;

  if (cachedResult) {
    return cachedResult;
  }

  const [{ countries }, { carbonOffsets }] = await Promise.all([
    gqlSdk.marketplace.getCountries(),
    gqlSdk.offsets.getCarbonOffsetsCountries(),
  ]);

  /** Handle invalid responses */
  if (!isArray(countries) || !isArray(carbonOffsets)) {
    throw new Error("Response from server did not match schema definition");
  }

  const fn = pipe(
    concat,
    flatten,
    uniq,
    filter(notEmptyOrNil),
    map((id: Country) => ({ id }))
  );

  const result: Country[] = fn([
    countries?.map(extract("id")),
    carbonOffsets.map(extract("country")),
  ]);

  await fastify.lcache.set(cacheKey, { payload: result });

  return result;
}

export type PriceType = Pick<Listing, "leftToSell" | "tokenAddress"> &
  Partial<Pick<Listing, "singleUnitPrice">> & {
    name: string;
  };

export function calculateProjectPoolPrices(
  poolProject: Partial<CarbonOffset>,
  uniqueValues: (string | undefined)[],
  poolPrices: TokenPrice[],
  prices: PriceType[] = []
): [string[], typeof prices] {
  if (parseFloat(poolProject.balanceNBO) >= 1) {
    uniqueValues.push(poolPrices.find((obj) => obj.name === "nbo")?.price);

    prices.push({
      leftToSell: poolProject.balanceNBO,
      tokenAddress: TOKEN_ADDRESSES[ENV].NBO_POOL,
      singleUnitPrice: poolPrices.find((obj) => obj.name === "nbo")?.priceInUsd,
      name: "NBO",
    });
  }
  if (parseFloat(poolProject.balanceUBO) >= 1) {
    uniqueValues.push(poolPrices.find((obj) => obj.name === "ubo")?.price);

    prices.push({
      leftToSell: poolProject.balanceUBO,
      tokenAddress: TOKEN_ADDRESSES[ENV].UBO_POOL,
      singleUnitPrice: poolPrices.find((obj) => obj.name === "ubo")?.priceInUsd,
      name: "UBO",
    });
  }
  if (parseFloat(poolProject.balanceNCT) >= 1) {
    uniqueValues.push(poolPrices.find((obj) => obj.name === "ntc")?.price);

    prices.push({
      leftToSell: poolProject.balanceNCT,
      tokenAddress: TOKEN_ADDRESSES[ENV].NTC_POOL,
      singleUnitPrice: poolPrices.find((obj) => obj.name === "ntc")?.priceInUsd,
      name: "NCT",
    });
  }
  if (parseFloat(poolProject.balanceBCT) >= 1) {
    uniqueValues.push(poolPrices.find((obj) => obj.name === "btc")?.price);

    prices.push({
      leftToSell: poolProject.balanceBCT,
      tokenAddress: TOKEN_ADDRESSES[ENV].BTC_POOL,
      singleUnitPrice: poolPrices.find((obj) => obj.name === "btc")?.priceInUsd,
      name: "BCT",
    });
  }

  return [compact(uniqueValues), prices];
}

export type TokenPrice = {
  priceInUsd: string;
  price: string;
  name: string;
};

type IsMatchingCmsProjectArgs = {
  registry: string; // (e.g VCS)
  projectId: string; // (e.g 1120)
};
/**
 * Checks if the provided project matches the given registry and project ID
 * @param {IsMatchingCmsProjectArgs} args - An object containing the registry and project ID to match
 * @param {Sanity.Default.Schema.Project} project - The project to check
 * @returns {boolean} - Returns true if the project matches the given registry and project ID, false otherwise
 */
export const isMatchingCmsProject = (
  { registry, projectId }: IsMatchingCmsProjectArgs,
  project: CarbonProject
) => project?.registryProjectId === projectId && project.registry === registry;
