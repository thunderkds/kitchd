declare module 'react/jsx-runtime' {
  export const Fragment: any;
  export const jsx: any;
  export const jsxs: any;
}

declare module 'react/jsx-dev-runtime' {
  export const Fragment: any;
  export const jsxDEV: any;
}

declare module 'react-native' {
  export const Platform: { OS: 'android' | 'ios' | 'web' | string };
  export const StyleSheet: {
    create<T extends Record<string, unknown>>(styles: T): T;
  };
  export function View(props: { children?: any; style?: unknown; [key: string]: unknown }): any;
  export function Text(props: { children?: any; style?: unknown; [key: string]: unknown }): any;
  export function TextInput(props: {
    children?: any;
    style?: unknown;
    value?: string;
    placeholder?: string;
    secureTextEntry?: boolean;
    keyboardType?: string;
    autoCapitalize?: string;
    autoCorrect?: boolean;
    editable?: boolean;
    onChangeText?: (text: string) => void;
    onSubmitEditing?: () => void;
    [key: string]: unknown;
  }): any;
  export function Pressable(props: {
    children?: any;
    style?: unknown;
    disabled?: boolean;
    onPress?: () => void;
    [key: string]: unknown;
  }): any;
}

declare module 'expo-router' {
  export function Stack(props: { screenOptions?: { headerShown?: boolean } }): any;
  export function useRouter(): {
    push(path: string): void;
    replace(path: string): void;
    back(): void;
    canGoBack(): boolean;
  };
  export function useLocalSearchParams(): Record<string, string | string[] | undefined>;
}

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_BASE_URL?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
