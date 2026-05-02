export function dasherize(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function camelize(value: string): string {
  const words = wordsOf(value);
  return words
    .map((word, index) => index === 0 ? word : capitalize(word))
    .join("");
}

export function classify(value: string): string {
  return wordsOf(value).map(capitalize).join("");
}

export function constantize(value: string): string {
  return wordsOf(value).map((word) => word.toUpperCase()).join("_");
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

function wordsOf(value: string): string[] {
  const dashed = dasherize(value);
  return dashed.split("-").filter(Boolean);
}
