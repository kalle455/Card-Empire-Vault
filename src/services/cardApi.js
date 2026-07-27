// cardApi.js — prepare for external cards API (stubbed for now)
export async function fetchCardMetadataByName(name) {
  // Placeholder implementation: in future call external API
  // Return image path (to be replaced by API result) and basic metadata
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return {
    id: slug,
    name,
    image: `/cards/${slug}.svg`, // prepared path
    source: 'local-stub',
  }
}

export async function searchCardImages(name) {
  // Returns array of candidate image URLs (stub)
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return [{ url: `/cards/${slug}.svg`, score: 0.9 }]
}
