declare module "refractor" {
  import type { Root } from "hast";

  interface Refractor {
    highlight: (value: string, language: string) => Root;
    register: (syntax: RefractorSyntax) => void;
    registered: (language: string) => boolean;
  }

  export type RefractorSyntax = ((refractor: Refractor) => void) & {
    displayName: string;
  };

  export const refractor: Refractor;
}

declare module "refractor/tsx" {
  import type { RefractorSyntax } from "refractor";

  const syntax: RefractorSyntax;
  export default syntax;
}
