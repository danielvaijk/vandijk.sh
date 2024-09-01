// Copyright (c) 2023 Daniel van Dijk (https://daniel.vandijk.sh)
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import type { QwikJSX } from "@builder.io/qwik";
import { component$ } from "@builder.io/qwik";

import { ArticleSummaryList } from "src/components/articles/article-summary-list";
import { CenteredTitle } from "src/components/centered-title";
import articles from "src/media/articles.json";

export default component$((): QwikJSX.Element => {
  if (articles.length === 0) {
    return <CenteredTitle title="Oh!" subtitle="There's nothing here yet." />;
  }

  return (
    <>
      <h2>Published Articles</h2>
      <ArticleSummaryList articles={articles} />
    </>
  );
});
