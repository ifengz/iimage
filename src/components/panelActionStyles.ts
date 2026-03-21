export const sharedPanelBodyStyle = {
  padding: 0,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  overflow: "hidden",
} as const;

export const compactGhostActionButtonStyle = {
  height: "28px",
  fontSize: "0.75rem",
} as const;

export const compactPrimaryActionButtonStyle = {
  ...compactGhostActionButtonStyle,
  minWidth: "60px",
  transition: "all 0.3s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
} as const;
