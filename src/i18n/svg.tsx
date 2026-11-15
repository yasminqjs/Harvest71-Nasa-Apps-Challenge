import React from 'react';
import { Text } from 'react-native-svg';
import { useLanguage } from './Language';
import { childrenInLanguage } from './native';

export function SvgText({ children, ...props }: React.ComponentProps<typeof Text>) {
  const { language } = useLanguage();
  return <Text {...props}>{childrenInLanguage(children, language)}</Text>;
}
