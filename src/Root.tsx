import React from "react";
import { Composition } from "remotion";
import { TextOverlay, textOverlaySchema } from "./compositions/TextOverlay";
import { ImageSlideshow, imageSlideshowSchema } from "./compositions/ImageSlideshow";
import { KenBurns, kenBurnsSchema } from "./compositions/KenBurns";
import { TitleCard, titleCardSchema } from "./compositions/TitleCard";
import { TransitionDemo, transitionDemoSchema } from "./compositions/TransitionDemo";
import { CaptionedClip, captionedClipSchema } from "./compositions/CaptionedClip";
import "./styles.css";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TextOverlay"
        component={TextOverlay}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        schema={textOverlaySchema}
        defaultProps={{
          text: "Hello World",
          fontSize: 80,
          color: "#ffffff",
          backgroundColor: "#000000",
          fontFamily: "Inter, sans-serif",
        }}
      />
      <Composition
        id="ImageSlideshow"
        component={ImageSlideshow}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        schema={imageSlideshowSchema}
        defaultProps={{
          images: [
            "https://picsum.photos/seed/1/1920/1080",
            "https://picsum.photos/seed/2/1920/1080",
            "https://picsum.photos/seed/3/1920/1080",
          ],
          transitionDuration: 15,
        }}
      />
      <Composition
        id="KenBurns"
        component={KenBurns}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        schema={kenBurnsSchema}
        defaultProps={{
          imageUrl: "https://picsum.photos/seed/kb/1920/1080",
          zoomStart: 1,
          zoomEnd: 1.3,
          direction: "in" as const,
        }}
      />
      <Composition
        id="TitleCard"
        component={TitleCard}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        schema={titleCardSchema}
        defaultProps={{
          title: "My Video",
          subtitle: "Created with Remotion",
          backgroundColor: "#1a1a2e",
          titleColor: "#e94560",
          subtitleColor: "#ffffff",
        }}
      />
      <Composition
        id="TransitionDemo"
        component={TransitionDemo}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
        schema={transitionDemoSchema}
        defaultProps={{
          text1: "Scene One",
          text2: "Scene Two",
          transitionType: "fade" as const,
          transitionDuration: 30,
        }}
      />
      <Composition
        id="CaptionedClip"
        component={CaptionedClip}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        schema={captionedClipSchema}
        defaultProps={{
          videoSrc: "",
          words: [],
          highlightColor: "#FFD700",
          textColor: "#FFFFFF",
          fontSize: 68,
          position: "bottom" as const,
          wordsPerGroup: 4,
          fontFamily: "Inter, Arial, sans-serif",
        }}
      />
    </>
  );
};
