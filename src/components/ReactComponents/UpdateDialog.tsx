import React from "react";
import Session from "../Global/Session.ts";

interface UpdateDialogProps {
  fromVersion: string;
  spicyLyricsVersion: string;
}

const UpdateDialog: React.FC<UpdateDialogProps> = ({ fromVersion, spicyLyricsVersion }) => {
  const prev = fromVersion ? Session.SpicyLyrics.ParseVersion(fromVersion) : undefined;
  const curr = spicyLyricsVersion ? Session.SpicyLyrics.ParseVersion(spicyLyricsVersion) : undefined;

  const isDowngrade = prev && curr ? Session.SpicyLyrics.CompareVersions(curr, prev) < 0 : false;
  return (
    <div className="update-card-wrapper slm">
      <h2 className="header">
        {isDowngrade
          ? "Spicy Lyrics has been downgraded!"
          : "Spicy Lyrics has been successfully updated!"}
      </h2>
      <div className="card version">
        Version: {fromVersion ? `${fromVersion} → ` : ""}{spicyLyricsVersion || "Unknown"}
      </div>
      <button
        className="card btn btn-release"
        onClick={() =>
          window.open(
            `https://github.com/Spikerko/spicy-lyrics/releases/tag/${spicyLyricsVersion}`,
            "_blank"
          )
        }
      >
        Release Notes →
      </button>
      <button
        className="card btn btn-discord"
        onClick={() => window.open("https://discord.com/invite/uqgXU5wh8j", "_blank")}
      >
        <p>Join our Discord Server! →</p>
      </button>
    </div>
  );
};

export default UpdateDialog;
