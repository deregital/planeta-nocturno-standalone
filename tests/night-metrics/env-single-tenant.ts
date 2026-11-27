// Antes que cualquier módulo de la app: la instancia es de una sola productora.
// DATABASE_URL se completa en el `before` de la prueba, con la base ya creada.
import { SIGNING_SECRET } from '@tests/night-metrics/pluto-helpers';

process.env.INSTANCE_WEB_URL = 'https://unica.test';
process.env.NEXT_PUBLIC_SITE_URL = 'https://unica.test';
process.env.NEXT_PUBLIC_INSTANCE_NAME = 'Productora única de prueba';
process.env.INSTANCE_CONTACT_EMAIL = 'hola@unica.test';
process.env.NEXT_PUBLIC_INSTANCE_DESCRIPTION = 'Instancia de prueba';
process.env.NEXT_PUBLIC_HUE = '200';
process.env.NEXT_PUBLIC_SATURATION = '80';
process.env.CREDENTIALS_SIGNING_SECRET = SIGNING_SECRET;
delete process.env.CONTROL_DATABASE_URL;
delete process.env.ROOT_DOMAIN;
