import { useState, useRef, useEffect } from "react";

interface DropDownProps {
  list: string[];
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

export default function DropDownMenu({ list, label = "Select", value = "", onChange, disabled = false }: DropDownProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative w-full flex">
      <button
        id="dropdownUsersButton"
        data-dropdown-toggle="dropdownUsers"
        data-dropdown-placement="bottom"
        className={`${value ? 'dark:text-white' : 'dark:text-gray-400'} font-medium rounded-lg dark:bg-[#242424] text-sm px-4 py-2.5 inline-flex items-center justify-between w-full border-[1.8px] dark:border-[#3c3c3c] focus:border-blue-600 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        type="button"
        onClick={() => !disabled && setIsOpen((isOpen) => !isOpen)}
        disabled={disabled}
      >
        {value || label}{" "}
        <svg
          className="w-2.5 h-2.5"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 10 6"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="m1 1 4 4 4-4"
          />
        </svg>
      </button>

      <div
        id="dropdownUsers"
        className="absolute top-12 z-50 bg-white rounded-lg shadow-lg w-full dark:bg-[#2f2f2f]"
        hidden={!isOpen}
      >
        <ul
          className="h-48 py-2 overflow-y-auto text-gray-700 dark:text-gray-200"
          aria-labelledby="dropdownUsersButton"
        >
          {list.map((item) => (
            <li key={item}>
              <button
                type="button"
                className="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white w-full text-left"
                onClick={() => {
                  onChange?.(item);
                  setIsOpen(false);
                }}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
