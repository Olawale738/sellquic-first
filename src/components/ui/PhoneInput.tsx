'use client';

import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

type Props = {
  value: string;
  onChange: (val: string) => void;
};

export default function PhoneField({ value, onChange }: Props) {
  return (
    <div className="phone-input-wrapper">
      <PhoneInput
        international
        defaultCountry="GH"
        countryOptionsOrder={['GH', 'NG', 'ZA', 'KE', 'GB', 'US', '|', '...']}
        value={value}
        onChange={(val) => onChange(val || '')}
        className="w-full h-11 sm:h-12 rounded-xl bg-slate-50 border-none font-bold px-3 text-sm sm:text-base"
      />
    </div>
  );
}
