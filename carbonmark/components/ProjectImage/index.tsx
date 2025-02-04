import { getImageSizes } from "@klimadao/lib/utils";
import { getCategoryInfo } from "lib/getCategoryInfo";
import { CategoryName } from "lib/types/carbonmark.types";
import Image from "next/legacy/image";
import { FC } from "react";

type Props = {
  category: CategoryName;
};

export const ProjectImage: FC<Props> = (props) => {
  const category = getCategoryInfo(props.category);

  return (
    <Image
      src={category.imageSrc}
      alt={category.label}
      objectFit="cover"
      layout="fill"
      sizes={getImageSizes({
        desktopLarge: "1116px",
      })}
    />
  );
};
