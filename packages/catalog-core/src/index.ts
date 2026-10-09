import {z} from 'zod';

export const locales = ['ru', 'en'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'ru';
export const localeSchema = z.enum(locales);
export const modelSchema = z.object({id:z.string().min(1).max(128), sourceId:z.string().min(1).max(128), makeId:z.string().min(1).max(128), label:z.string().min(1).max(200)});
export type VehicleModel = z.infer<typeof modelSchema>;
export const modelListSchema = z.object({data:z.array(modelSchema), status:z.enum(['empty', 'ready'])});
export const favoriteSchema = z.object({version:z.literal(1), modelIds:z.array(z.string().min(1).max(128)).max(100)});
export const favoritesKey = 'selection-auto-parts:favorite-models:v1';
export function parseFavorites(value: string | null): string[] {
  try { const parsed = favoriteSchema.safeParse(JSON.parse(value ?? 'null')); return parsed.success ? [...new Set(parsed.data.modelIds)] : []; } catch { return []; }
}
export function toggleFavorite(ids: string[], id: string): string[] {
  if (!modelSchema.shape.id.safeParse(id).success) return ids;
  return ids.includes(id) ? ids.filter(value => value !== id) : [...new Set([...ids, id])].slice(0, 100);
}
export function localizedLabel(labels: Partial<Record<Locale, string>>, locale: Locale, original: string): string {
  return labels[locale] || labels[defaultLocale] || original;
}
export const modelsQuerySchema = z.object({locale:localeSchema.default('ru'),makeId:z.string().min(1).max(128).optional()}).strict();
