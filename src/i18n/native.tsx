import React from 'react';
import { Pressable as RNPressable, Text as RNText, TextInput as RNTextInput } from 'react-native';
import { useLanguage, type Language } from './Language';
import { translate } from './translate';

export function childrenInLanguage(children: React.ReactNode, language: Language): React.ReactNode {
  if (typeof children === 'string') return translate(children, language);
  if (!Array.isArray(children)) return children;
  if (children.every((child) => child == null || ['string', 'number', 'boolean'].includes(typeof child))) {
    const joined = children.filter((child) => typeof child === 'string' || typeof child === 'number').join('');
    const translated = translate(joined, language);
    if (translated !== joined) return translated;
  }
  return children.map((child) => childrenInLanguage(child, language));
}

function accessible<T extends { accessibilityLabel?: string; accessibilityHint?: string }>(props: T, language: Language): T {
  return {
    ...props,
    accessibilityLabel: props.accessibilityLabel && translate(props.accessibilityLabel, language),
    accessibilityHint: props.accessibilityHint && translate(props.accessibilityHint, language),
  };
}

export const Text = React.forwardRef<React.ComponentRef<typeof RNText>, React.ComponentPropsWithoutRef<typeof RNText>>(
  ({ children, ...props }, ref) => {
    const { language } = useLanguage();
    return <RNText {...accessible(props, language)} ref={ref}>{childrenInLanguage(children, language)}</RNText>;
  },
);
Text.displayName = 'LocalizedText';

export const TextInput = React.forwardRef<React.ComponentRef<typeof RNTextInput>, React.ComponentPropsWithoutRef<typeof RNTextInput>>(
  ({ placeholder, ...props }, ref) => {
    const { language } = useLanguage();
    return <RNTextInput {...accessible(props, language)} ref={ref}
      placeholder={placeholder && translate(placeholder, language)} />;
  },
);
TextInput.displayName = 'LocalizedTextInput';

export const Pressable = React.forwardRef<React.ComponentRef<typeof RNPressable>, React.ComponentPropsWithoutRef<typeof RNPressable>>(
  (props, ref) => {
    const { language } = useLanguage();
    return <RNPressable {...accessible(props, language)} ref={ref} />;
  },
);
Pressable.displayName = 'LocalizedPressable';
