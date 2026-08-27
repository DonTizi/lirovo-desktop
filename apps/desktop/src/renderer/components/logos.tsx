import { Captions } from "lucide-react";

/**
 * Brand marks, vendored.
 *
 * Downloaded once and inlined rather than linked: the panel that reports
 * whether this machine can work offline must itself draw offline, and a logo
 * that fails to load reads as the integration being broken.
 *
 * Sources: simple-icons (FFmpeg, CC0-1.0), @lobehub/icons (OpenAI, Ollama,
 * Claude, MIT), and the yt-dlp project's own avatar. Each is used nominatively,
 * to name the tool it belongs to, and nothing here claims endorsement.
 */

const box = "shrink-0";

/**
 * Monochrome marks take the surrounding text colour so they survive the theme
 * flip; the two brands whose colour IS the mark keep theirs.
 */
export function FfmpegMark({ className }: { className?: string | undefined }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={`${box} ${className ?? ""}`} fill="#007808" aria-hidden>
      <path d="M21.72 17.91V6.5l-.53-.49L9.05 18.52l-1.29-.06L24 1.53l-.33-.95-11.93 1-5.75 6.6v-.23l4.7-5.39-1.38-.77-9.11.77v2.85l1.91.46v.01l.19-.01-.56.66v10.6c.609-.126 1.22-.241 1.83-.36L14.12 5.22l.83-.04L0 21.44l9.67.82 1.35-.77 6.82-6.74v2.15l-5.72 5.57 11.26.95.35-.94v-3.16l-3.29-.18c.434-.403.858-.816 1.28-1.23z"/>
    </svg>
  );
}

export function OpenAiMark({ className }: { className?: string | undefined }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={`${box} ${className ?? ""}`} fill="currentColor" fillRule="evenodd" aria-hidden>
      <path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"></path>
    </svg>
  );
}

export function OllamaMark({ className }: { className?: string | undefined }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={`${box} ${className ?? ""}`} fill="currentColor" fillRule="evenodd" aria-hidden>
      <path d="M7.905 1.09c.216.085.411.225.588.41.295.306.544.744.734 1.263.191.522.315 1.1.362 1.68a5.054 5.054 0 012.049-.636l.051-.004c.87-.07 1.73.087 2.48.474.101.053.2.11.297.17.05-.569.172-1.134.36-1.644.19-.52.439-.957.733-1.264a1.67 1.67 0 01.589-.41c.257-.1.53-.118.796-.042.401.114.745.368 1.016.737.248.337.434.769.561 1.287.23.934.27 2.163.115 3.645l.053.04.026.019c.757.576 1.284 1.397 1.563 2.35.435 1.487.216 3.155-.534 4.088l-.018.021.002.003c.417.762.67 1.567.724 2.4l.002.03c.064 1.065-.2 2.137-.814 3.19l-.007.01.01.024c.472 1.157.62 2.322.438 3.486l-.006.039a.651.651 0 01-.747.536.648.648 0 01-.54-.742c.167-1.033.01-2.069-.48-3.123a.643.643 0 01.04-.617l.004-.006c.604-.924.854-1.83.8-2.72-.046-.779-.325-1.544-.8-2.273a.644.644 0 01.18-.886l.009-.006c.243-.159.467-.565.58-1.12a4.229 4.229 0 00-.095-1.974c-.205-.7-.58-1.284-1.105-1.683-.595-.454-1.383-.673-2.38-.61a.653.653 0 01-.632-.371c-.314-.665-.772-1.141-1.343-1.436a3.288 3.288 0 00-1.772-.332c-1.245.099-2.343.801-2.67 1.686a.652.652 0 01-.61.425c-1.067.002-1.893.252-2.497.703-.522.39-.878.935-1.066 1.588a4.07 4.07 0 00-.068 1.886c.112.558.331 1.02.582 1.269l.008.007c.212.207.257.53.109.785-.36.622-.629 1.549-.673 2.44-.05 1.018.186 1.902.719 2.536l.016.019a.643.643 0 01.095.69c-.576 1.236-.753 2.252-.562 3.052a.652.652 0 01-1.269.298c-.243-1.018-.078-2.184.473-3.498l.014-.035-.008-.012a4.339 4.339 0 01-.598-1.309l-.005-.019a5.764 5.764 0 01-.177-1.785c.044-.91.278-1.842.622-2.59l.012-.026-.002-.002c-.293-.418-.51-.953-.63-1.545l-.005-.024a5.352 5.352 0 01.093-2.49c.262-.915.777-1.701 1.536-2.269.06-.045.123-.09.186-.132-.159-1.493-.119-2.73.112-3.67.127-.518.314-.95.562-1.287.27-.368.614-.622 1.015-.737.266-.076.54-.059.797.042zm4.116 9.09c.936 0 1.8.313 2.446.855.63.527 1.005 1.235 1.005 1.94 0 .888-.406 1.58-1.133 2.022-.62.375-1.451.557-2.403.557-1.009 0-1.871-.259-2.493-.734-.617-.47-.963-1.13-.963-1.845 0-.707.398-1.417 1.056-1.946.668-.537 1.55-.849 2.485-.849zm0 .896a3.07 3.07 0 00-1.916.65c-.461.37-.722.835-.722 1.25 0 .428.21.829.61 1.134.455.347 1.124.548 1.943.548.799 0 1.473-.147 1.932-.426.463-.28.7-.686.7-1.257 0-.423-.246-.89-.683-1.256-.484-.405-1.14-.643-1.864-.643zm.662 1.21l.004.004c.12.151.095.37-.056.49l-.292.23v.446a.375.375 0 01-.376.373.375.375 0 01-.376-.373v-.46l-.271-.218a.347.347 0 01-.052-.49.353.353 0 01.494-.051l.215.172.22-.174a.353.353 0 01.49.051zm-5.04-1.919c.478 0 .867.39.867.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zm8.706 0c.48 0 .868.39.868.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zM7.44 2.3l-.003.002a.659.659 0 00-.285.238l-.005.006c-.138.189-.258.467-.348.832-.17.692-.216 1.631-.124 2.782.43-.128.899-.208 1.404-.237l.01-.001.019-.034c.046-.082.095-.161.148-.239.123-.771.022-1.692-.253-2.444-.134-.364-.297-.65-.453-.813a.628.628 0 00-.107-.09L7.44 2.3zm9.174.04l-.002.001a.628.628 0 00-.107.09c-.156.163-.32.45-.453.814-.29.794-.387 1.776-.23 2.572l.058.097.008.014h.03a5.184 5.184 0 011.466.212c.086-1.124.038-2.043-.128-2.722-.09-.365-.21-.643-.349-.832l-.004-.006a.659.659 0 00-.285-.239h-.004z"></path>
    </svg>
  );
}

export function ClaudeMark({ className }: { className?: string | undefined }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={`${box} ${className ?? ""}`} fill="#D97757" fillRule="evenodd" aria-hidden>
      <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"></path>
    </svg>
  );
}

/** yt-dlp ships a raster mark and no vector one, so this is its avatar. */
const YTDLP_SRC = "data:image/png;base64,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";

export function YtDlpMark({ className }: { className?: string | undefined }): JSX.Element {
  return <img src={YTDLP_SRC} alt="" className={`${box} rounded-sm ${className ?? ""}`} aria-hidden />;
}

/**
 * Which mark a probed thing wears.
 *
 * Several things share one: ffprobe ships inside FFmpeg, and Whisper is
 * OpenAI's model wherever it runs. A caller drawing a row of brands dedupes on
 * this rather than on a hand-kept list of ids.
 */
export const markFamily = (id: string): string => {
  switch (id) {
    case "ffmpeg":
    case "ffprobe":
      return "ffmpeg";
    case "whisper-cli":
    case "whisper-cpp":
    case "whisper-api":
    case "codex":
      return "openai";
    case "yt-dlp":
    case "local":
    case "claude":
      return id;
    default:
      return "other";
  }
};

/**
 * The mark for one probed thing.
 *
 * Whisper is OpenAI's model wherever it runs, so both transcription links wear
 * that mark; published subtitles belong to no vendor and get a glyph.
 */
export function Mark({ id, className }: { id: string; className?: string | undefined }): JSX.Element {
  switch (id) {
    case "ffmpeg":
    case "ffprobe":
      return <FfmpegMark className={className} />;
    case "yt-dlp":
      return <YtDlpMark className={className} />;
    case "whisper-cli":
    case "whisper-cpp":
    case "whisper-api":
    case "codex":
      return <OpenAiMark className={className} />;
    case "local":
      return <OllamaMark className={className} />;
    case "claude":
      return <ClaudeMark className={className} />;
    default:
      return <Captions className={`${box} ${className ?? ""}`} aria-hidden />;
  }
}
