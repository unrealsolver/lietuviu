import personalPronounsGridData from "../../../tables/personal-pronouns.html?grid";
import { GridTable } from "../GridTable";

export function PersonalPronounsPage() {
  return <GridTable cells={personalPronounsGridData.cells} />;
}
