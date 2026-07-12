declare module "refractor" {
  import type { Root } from "hast";

  interface Refractor {
    highlight: (value: string, language: string) => Root;
    register: (syntax: RefractorSyntax) => void;
    registered: (language: string) => boolean;
  }

  type RefractorSyntax = ((refractor: Refractor) => void) & {
    displayName: string;
  };

  const refractor: Refractor;

  export {
    type Refractor,
    type RefractorSyntax,
    refractor,
  };
}

declare module "refractor/tsx" {
  import type { RefractorSyntax } from "refractor";

  const syntax: RefractorSyntax;
  export default syntax;
}

export type RefractorDtsModuleMarker = unknown;
