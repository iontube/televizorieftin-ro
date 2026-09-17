import { defineCollection, z } from 'astro:content';

const landings = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    h1: z.string(),
    kw: z.string(),
    updated: z.string(),
    hero: z.string(),
    heroAlt: z.string(),
    intro: z.array(z.string()).default([]),
    summary: z.array(z.string()).default([]),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

export const collections = { landings };
