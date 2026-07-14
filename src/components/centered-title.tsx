import {
  type PropFunction,
  type QwikJSX,
  component$,
  useSignal,
  useStylesScoped$,
  useVisibleTask$,
} from "@builder.io/qwik";
import TypeIt, { type Options as TypeItOptions } from "typeit";

import styles from "src/components/centered-title.css?inline";

interface CenteredTitleProps {
  subtitle: string;
  subtitleId?: string;
  title: string;
  titleId?: string;
  typeTitle$?: PropFunction<(typeIt: TypeIt) => void>;
  typeTitleOptions?: TypeItOptions;
}

export const CenteredTitle = component$<CenteredTitleProps>(
  ({ subtitle, subtitleId, title, titleId, typeTitle$, typeTitleOptions }): QwikJSX.Element => {
    const staticTitleElement = useSignal<HTMLSpanElement>();
    const typedTitleElement = useSignal<HTMLSpanElement>();

    useStylesScoped$(styles);

    useVisibleTask$(({ cleanup }): void => {
      if (!typeTitle$) {
        return;
      }

      const element = typedTitleElement.value;

      if (!element) {
        return;
      }

      let isCleanedUp = false;
      const configuredOptions = typeTitleOptions ?? {};
      const configuredAfterStep = configuredOptions.afterStep;
      const staticTitle = staticTitleElement.value;
      let didRevealTypedTitle = false;
      const typeIt = new TypeIt(element, {
        ...configuredOptions,
        afterStep: async (instance: TypeIt): Promise<void> => {
          if (!didRevealTypedTitle && element.textContent !== title) {
            didRevealTypedTitle = true;
            element.hidden = false;
            staticTitle?.setAttribute("hidden", "");
          }

          await configuredAfterStep?.(instance);
        },
      });

      const startTypeIt = (): void => {
        if (!isCleanedUp) {
          typeIt.go();
        }
      };

      if (typeTitle$) {
        typeTitle$(typeIt).then((): void => {
          startTypeIt();
        });
      } else {
        startTypeIt();
      }

      cleanup((): void => {
        isCleanedUp = true;
        typeIt.destroy();
        staticTitle?.removeAttribute("hidden");
        element.hidden = true;
        element.textContent = title;
      });
    });

    return (
      <div class="centered-title">
        <h2 aria-label={title} id={titleId}>
          <span aria-hidden="true" class="centered-title-static-title" ref={staticTitleElement}>
            {title}
          </span>
          <span
            aria-hidden="true"
            class="centered-title-typed-title"
            hidden
            ref={typedTitleElement}
          >
            {typeTitle$ ? title : ""}
          </span>
        </h2>
        <strong class="centered-title-subtitle" id={subtitleId}>
          {subtitle}
        </strong>
      </div>
    );
  },
);
