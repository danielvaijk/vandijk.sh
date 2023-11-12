import { component$ } from "@builder.io/qwik";
import { CenteredTitle } from "~/components/centered-title";

export default component$(() => {
  return (
    <CenteredTitle
      title="404"
      subtitle="The article you're looking for doesn't exist."
    />
  );
});
