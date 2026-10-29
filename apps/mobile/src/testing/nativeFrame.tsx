import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { screen } from '@testing-library/react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

/** M010 AC2 + AC3: the screen sits inside the safe area and a keyboard-avoiding container. */
export function expectSafeAreaAndKeyboardAvoidance() {
  expect(screen.UNSAFE_getAllByType(SafeAreaView).length).toBeGreaterThan(0)
  const avoiding = screen.UNSAFE_getAllByType(KeyboardAvoidingView)
  expect(avoiding.length).toBeGreaterThan(0)
  expect(avoiding[0].props.behavior).toBe(Platform.OS === 'ios' ? 'padding' : 'height')
}

/**
 * M010 AC1: the screen renders its rows through one FlashList (not nested in a ScrollView) whose
 * keyExtractor returns the entity id for each entity row. Returns every key the list produces.
 */
export function expectFlashListKeyedBy(entityIds: string[]): string[] {
  const list = screen.UNSAFE_getByType(FlashList)

  let ancestor = list.parent
  while (ancestor) {
    expect(ancestor.type).not.toBe(ScrollView)
    ancestor = ancestor.parent
  }

  const keyExtractor = list.props.keyExtractor as (item: unknown, index: number) => string
  const keys = (list.props.data as unknown[]).map((item, index) => keyExtractor(item, index))
  expect(new Set(keys).size).toBe(keys.length)
  for (const id of entityIds) {
    expect(keys).toContain(id)
  }
  return keys
}
