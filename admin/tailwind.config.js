/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: 'jit',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/stories/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontSize: {
      label_primary: '14px',
      button_primary: '12px',
      bubble_primary: '13px',

      headline_small:'14px',
      headline_normal:'16px',
      headline_medium:'18px',
      headline_large:'24px',

      contentText_small:'12px',
      contentText_normal:'14px',
      contentText_large:'16px',

    },

    extend: {
      colors: {
        //黃ok
        primary: '#FFAB37',
        primary_lightest: '#FFEED7',//disable
        primary_light: '#FFC576',//?hover
        primary_dark: '#F08F36',//focus
        //綠?
        secondary: '#93C976',
        secondary_lightest: '#E9F4E4',
        secondary_light: '#B8E0A3',
        secondary_dark: '#669A4A',
        // 藍色?
        tertiary: '#2B84FF',
        tertiary_lightest: '#B8D6FF',
        tertiary_light: '#72ADFF',
        tertiary_dark: '#1D58AA',
        // imMaster綠色?
        quaternary: '#7993B7',
        quaternary_lightest: '#A5C2EB',
        quaternary_light: '#9DB3D2',
        quaternary_dark: '#627CA1',

        //紅ok
        alert: '#EB6666',
        alert_lightest: '#FBE0E0',
        alert_light: '#FFC5C5',
        alert_dark: '#C94848',
        //灰ok
        grayscale: '#666666',
        grayscale_lightest: '#D9D9D9',
        grayscale_light: '#B3B3B3',
        grayscale_dark: '#4B4B4B',//我freestyle的
        // 文字使用
        black_primary:'#000000',
        black_secondary:'#666666',
        black_tertiary:'#B3B3B3',
        black_quaternary:'#D9D9D9',
        black_quinary:'#E6E6E6',
        black_white:'#FFFFFF',
      },
      backgroundColor: {
        bubble_primary:'#F7DFBA',
        bubble_secondary:'white',
        bg_primary:'#ffffff',
        bg_secondary:'#F7F7F7',
        bg_tertiary:'#EFEFEF',
        bg_popup:'#000000',
        imMaster_blue900:'#164280',
        imMaster_green:'#7BD4BF',

        // primary: '#FFEED7',
        // primary_dark: '#FFAB37',
        // primary_light: '#FFAB37',
        // label_secondary: '#E9F4E4',
        // label_decoration_secondary: '#93C976',
        // label_tertiary: '#FBE0E0',
        // label_decoration_tertiary: '#EB6666',
        // button_primary: '#FFAB37',
        // button_secondary: '#666666',
        // button_alert: '#EB6666',
      }

    },
  },
  plugins: [],
}