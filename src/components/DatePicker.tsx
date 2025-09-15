interface DatePickerProps {
  id: string;
  label: string;
  register: any;
  errors: any;
}

export function DatePicker({
  id,
  label,
  register,
  errors,
}: DatePickerProps): React.JSX.Element {
  return (
    <div className="relative">
      <input
        type="date"
        id={id}
        {...register(id, { 
          required: `${label} is required`,
          validate: (value: string) => {
            const selectedDate = new Date(value);
            const today = new Date();
            today.setHours(23, 59, 59, 999); // End of today
            return selectedDate <= today || "Date cannot be in the future";
          }
        })}
        max={new Date().toISOString().split('T')[0]} // Today's date in YYYY-MM-DD format
        className={`block px-2.5 pb-2.5 pt-4 w-full text-sm dark:bg-[#242424] text-gray-900 rounded-lg border-[1.8px] ${
          errors[id] ? "border-red-500" : "border-gray-300 dark:border-gray-600 focus:border-blue-600"
        } appearance-none dark:text-white focus:outline-none focus:ring-0 peer`}
        placeholder=" "
        autoComplete="off"
      />
      <div className={`absolute text-sm text-gray-500 dark:text-gray-400 ${errors[id] ? "peer-focus:text-red-500" : "peer-focus:text-blue-600"} duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] px-2 peer-focus:px-2 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-6 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1`}>
        <label htmlFor={id}>{label}</label>
        <div className="absolute h-[12px] -z-10 w-11/12 top-[3px] left-1 bg-white dark:bg-[#242424] rounded-xs"/>
      </div>
      {errors[id] && (
        <p className="text-left pl-2.5 pt-1 text-red-500 text-sm">
          {errors[id].message}
        </p>
      )}
    </div>
  );
}