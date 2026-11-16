import { z } from 'zod';
import { optionalEmail, optionalText, optionalUrl, requiredText } from './common';

export const instituteSchema = z.object({
  name: requiredText(200),
  acronym: optionalText(20),
  address: optionalText(),
  city: optionalText(100),
  country: optionalText(100),
  phone: optionalText(50),
  email: optionalEmail,
  website: optionalUrl,
  logoUrl: optionalUrl,
  directorName: optionalText(150),
});
export type InstituteInput = z.input<typeof instituteSchema>;
