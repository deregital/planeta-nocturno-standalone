import * as relations from '@/drizzle/relations';
import * as models from '@/drizzle/schema';
import { feature } from '@/drizzle/schema';
import { FEATURE_KEYS, FeatureKey } from '@/server/constants/feature-keys';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';

const db = drizzle(process.env.DATABASE_URL!, {
  schema: {
    ...relations,
    ...models,
  },
});

async function main() {
  const features = Object.entries(FEATURE_KEYS).map(([_, key]) => {
    return key;
  });

  for (const featureKey of features) {
    await db
      .insert(feature)
      .values({ key: featureKey as FeatureKey, enabled: false });
    console.log(`✓ Created feature: ${featureKey}`);
  }

  console.log('Feature flags seeding completed!');
}

main()
  .catch((error) => {
    console.error('Error seeding feature flags:', error);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
