import { t } from "@lingui/macro";
import ChartCard, { CardProps } from "components/cards/ChartCard";
import {
  DailyEthCarbonRetirementsChart,
  DailyPolygonCarbonRetirementsChart,
} from "components/charts/DailyCarbonRetirementsChart";
import { getChainsOptionsWithoutCelo } from "lib/charts/options";
import { ChartDictionnary } from "lib/charts/types";

/** Verra Credits Card */
export default function DailyCarbonRetirementsCard(props: CardProps) {
  const charts: ChartDictionnary = {
    /* @ts-expect-error async Server component */
    polygon: <DailyPolygonCarbonRetirementsChart />,
    /* @ts-expect-error async Server component */
    eth: <DailyEthCarbonRetirementsChart />,
  };
  return (
    <ChartCard
      {...props}
      title={t`On-chain retirements`}
      detailUrl="/details/digital-carbon-retirements-snapshot"
      bottomOptions={getChainsOptionsWithoutCelo()}
      charts={charts}
    />
  );
}
