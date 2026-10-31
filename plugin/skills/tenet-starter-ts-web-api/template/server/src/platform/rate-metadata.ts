// Only normalized metadata may reach the plugin's dynamic groupId lookup.
const sealed = new WeakSet<object>();
const invalid = () => new Error("Unsupported rate-limit metadata");

function rateValue(config: unknown): unknown {
  if (config === undefined || config === null) return undefined;
  if (typeof config !== "object") throw invalid();
  const descriptor = Object.getOwnPropertyDescriptor(config, "rateLimit");
  if (!descriptor) return undefined;
  if (!Object.hasOwn(descriptor, "value")) throw invalid();
  return descriptor.value;
}

function normalize(value: unknown): object | undefined {
  if (value === undefined || value === false) return undefined;
  if (value === null || typeof value !== "object") throw invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) throw invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value) as Record<PropertyKey, PropertyDescriptor>;
  if (Reflect.ownKeys(descriptors).some(key => !Object.hasOwn(descriptors[key]!, "value"))) throw invalid();
  if (Object.hasOwn(descriptors, "groupId") && descriptors.groupId!.value !== undefined) throw invalid();
  const copy: object = Object.defineProperties(Object.create(null), descriptors);
  Object.defineProperty(copy, "groupId", { value: undefined, writable: false, configurable: false });
  Object.freeze(copy); sealed.add(copy);
  return copy;
}

/** Diagnostic only: later hooks may detach registration options from served configuration. */
export function assertRateMetadata(config: unknown): void { normalize(rateValue(config)); }

/** Idempotent for actual served configuration; no request or identity is cached. */
export function sealRateMetadata(config: object): void {
  const value = rateValue(config), descriptor = Object.getOwnPropertyDescriptor(config, "rateLimit");
  if (descriptor && !descriptor.configurable && !descriptor.writable) {
    if (value === undefined || (typeof value === "object" && value !== null && sealed.has(value))) return;
    throw invalid();
  }
  Object.defineProperty(config, "rateLimit", { value: normalize(value), writable: false, configurable: false });
}
