import { LoadingSpinner } from "./LoadingSpinner";

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  isGrayedOut?: boolean;
}

export function Button({
  label,
  onClick,
  disabled,
  isLoading,
  isGrayedOut,
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`justify-center text-white rounded-lg px-5 py-2.5 inline-flex items-center cursor-pointer ${
        isGrayedOut || disabled
          ? "bg-slate-700"
          : "bg-blue-600 hover:bg-blue-700 "
      }`}
      onClick={onClick}
    >
      <LoadingSpinner hidden={!isLoading} />
      {label}
    </button>
  );
}
