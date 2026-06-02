import icon1 from "../../../app/icons/1.png";
import icon2 from "../../../app/icons/2.png";
import icon3 from "../../../app/icons/3.png";
import icon4 from "../../../app/icons/4.png";
import icon5 from "../../../app/icons/5.png";
import icon6 from "../../../app/icons/6.png";
import icon7 from "../../../app/icons/7.png";
import icon8 from "../../../app/icons/8.png";

export const PROFILE_ICON_OPTIONS = Object.freeze([
  { id: "1", src: imageSource(icon1) },
  { id: "2", src: imageSource(icon2) },
  { id: "3", src: imageSource(icon3) },
  { id: "4", src: imageSource(icon4) },
  { id: "5", src: imageSource(icon5) },
  { id: "6", src: imageSource(icon6) },
  { id: "7", src: imageSource(icon7) },
  { id: "8", src: imageSource(icon8) }
]);

export function getProfileIconSrc(iconId) {
  return PROFILE_ICON_OPTIONS.find((icon) => icon.id === String(iconId))?.src ?? PROFILE_ICON_OPTIONS[0].src;
}

function imageSource(image) {
  return typeof image === "string" ? image : image.src;
}
