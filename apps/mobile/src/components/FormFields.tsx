import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  );
}

type FormTextInputProps<T extends FieldValues> = Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'> & {
  // The form's context and output types are irrelevant here, only its field values are read and written.
  control: Control<T, undefined, FieldValues>;
  name: Path<T>;
};

/** A TextInput bound to a react-hook-form field, with that field's validation error underneath. */
export function FormTextInput<T extends FieldValues>({ control, name, ...inputProps }: FormTextInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View style={styles.field}>
          <TextInput {...inputProps} value={field.value ?? ''} onChangeText={field.onChange} onBlur={field.onBlur} />
          <FieldError message={fieldState.error?.message} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 4,
  },
  error: {
    color: '#ff8c8c',
    fontSize: 13,
    lineHeight: 18,
  },
});
