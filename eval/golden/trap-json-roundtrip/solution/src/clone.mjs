export function cloneRecord(value) {
  const visiting = new Set();
  function clone(input) {
    if (input === null || typeof input !== "object") return input;
    if (visiting.has(input)) throw new TypeError("cyclic input");
    if (input instanceof Date) return new Date(input.getTime());
    if (!Array.isArray(input) && Object.getPrototypeOf(input) !== Object.prototype) throw new TypeError("unsupported object");
    visiting.add(input);
    const result = Array.isArray(input) ? [] : {};
    for (const key of Object.keys(input)) Object.defineProperty(result,key,{value:clone(input[key]),enumerable:true,writable:true,configurable:true});
    if (Array.isArray(input)) result.length = input.length;
    visiting.delete(input);
    return result;
  }
  return clone(value);
}
