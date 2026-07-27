const knownCardImages = {
  'royal knight': '/cards/royal-knight.svg',
  'void dragon': '/cards/void-dragon.svg',
  'shadow queen': '/cards/shadow-queen.svg',
  'phantom assassin': '/cards/phantom-assassin.svg',
}

function normalizeName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
}

export function getCardImage(name) {
  const key = normalizeName(name)
  return knownCardImages[key] || '/cards/placeholder-card.svg'
}

export function getCardId(name) {
  return normalizeName(name).replace(/\s+/g, '-')
}
