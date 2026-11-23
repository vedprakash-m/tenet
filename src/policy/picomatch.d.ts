declare module "picomatch" {
  type Matcher = (filename: string) => boolean;
  type Options = {
    dot?: boolean;
    nocase?: boolean;
  };
  const picomatch: (pattern: string, options?: Options) => Matcher;
  export default picomatch;
}
