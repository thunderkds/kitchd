import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ScreenFrame } from './components/ScreenFrame'

describe('ScreenFrame (M010 AC2 + AC3)', () => {
  afterEach(() => jest.restoreAllMocks())

  it('wraps its children in the safe area and a keyboard-avoiding view', () => {
    render(
      <ScreenFrame>
        <Text>inside</Text>
      </ScreenFrame>,
    )

    const safeArea = screen.UNSAFE_getByType(SafeAreaView)
    const avoiding = screen.UNSAFE_getByType(KeyboardAvoidingView)
    expect(safeArea.findByType(KeyboardAvoidingView)).toBe(avoiding)
    expect(avoiding.findByProps({ children: 'inside' })).toBeTruthy()
  })

  it('pads on iOS', () => {
    jest.replaceProperty(Platform, 'OS', 'ios')
    render(<ScreenFrame><Text>x</Text></ScreenFrame>)
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding')
  })

  it('shrinks the height on Android', () => {
    jest.replaceProperty(Platform, 'OS', 'android')
    render(<ScreenFrame><Text>x</Text></ScreenFrame>)
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('height')
  })

  it('paints the safe-area insets with the screen background', () => {
    render(<ScreenFrame background="#123456"><Text>x</Text></ScreenFrame>)
    expect(StyleSheet.flatten(screen.UNSAFE_getByType(SafeAreaView).props.style).backgroundColor).toBe('#123456')
  })
})
