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
      const element = typedTitleElement.value;

      if (!element) {
        return;
      }

      let isCleanedUp = false;
      const configuredOptions = typeTitleOptions ?? {};
      const shouldStartByDeletingTitle = typeTitle$ && configuredOptions.startDelete === true;
      const options = typeTitle$
        ? configuredOptions
        : Object.assign(configuredOptions, {
            startDelay: configuredOptions.startDelay ?? 0,
            startDelete: false,
            strings: [],
          });

      if (shouldStartByDeletingTitle) {
        element.textContent = title;
      }

      const typeIt = new TypeIt(element, options);

      if (!typeTitle$) {
        element.textContent = title;
      }

      element.hidden = false;
      const staticTitle = staticTitleElement.value;
      if (staticTitle) {
        staticTitle.setAttribute("hidden", "");
      }

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
        if (staticTitle) {
          staticTitle.removeAttribute("hidden");
        }
        element.hidden = true;
        element.textContent = "";
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
          />
        </h2>
        <strong class="centered-title-subtitle" id={subtitleId}>
          {subtitle}
        </strong>
      </div>
    );
  },
);
