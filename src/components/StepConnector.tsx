// The vertical dotted connector that visually links the form sections.
// Variant "first" omits the line above the dot, "last" omits the line below.
export function StepConnector({ variant = "middle" }: { variant?: "first" | "middle" | "last" }) {
  const showTop = variant !== "first";
  const showBottom = variant !== "last";

  return (
    <div className="flex w-7 flex-col items-center self-stretch">
      <div className={`w-px flex-1 ${showTop ? "bg-brand-200" : ""}`} />
      <div className="size-3.5 rounded-full border-2 border-brand bg-white" />
      <div className={`w-px flex-1 ${showBottom ? "bg-brand-200" : ""}`} />
    </div>
  );
}
