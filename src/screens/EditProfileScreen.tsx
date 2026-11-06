import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Avatar from '@/components/Avatar';
import BioText from '@/components/BioText';
import { useSession } from '@/context/session';
import { BIO_MAX_LENGTH, fetchProfile, updateBio, uploadAvatar, type Profile } from '@/lib/posts';
import { useTheme } from '@/theme/ThemeProvider';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
};

export default function EditProfileScreen() {
  const { session } = useSession();
  const { colors } = useTheme();
  const userId = session?.user.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchProfile(userId)
      .then((p) => {
        setProfile(p);
        setBio(p.bio ?? '');
      })
      .catch(() => Alert.alert('Could not load your profile'));
  }, [userId]);

  async function pick(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', `Allow access to your ${source === 'camera' ? 'camera' : 'photos'} in Settings.`);
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  function changePhoto() {
    Alert.alert('Profile photo', undefined, [
      { text: 'Take photo', onPress: () => pick('camera') },
      { text: 'Choose from library', onPress: () => pick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function save() {
    if (!userId || !profile) return;
    setSaving(true);
    try {
      if (photo) await uploadAvatar(userId, photo, profile.avatar_path);
      if (bio.trim() !== (profile.bio ?? '')) await updateBio(userId, bio);
      router.back();
    } catch {
      Alert.alert('Could not save your profile', 'Please try again.');
      setSaving(false);
    }
  }

  const trimmed = bio.trim();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Avatar uri={photo?.uri} path={profile?.avatar_path} size={96} />
        <Pressable onPress={changePhoto} disabled={saving}>
          <Text style={[styles.link, { color: colors.primary }]}>Change profile photo</Text>
        </Pressable>

        <Text style={[styles.label, { color: colors.text }]}>Bio</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={BIO_MAX_LENGTH}
          placeholder="Write something about yourself…"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface }]}
          editable={!saving}
        />
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Markdown supported: **bold**, *italic*, [links](https://example.com), lists. {bio.length}/{BIO_MAX_LENGTH}
        </Text>

        <Text style={[styles.label, { color: colors.text }]}>Preview</Text>
        <View style={[styles.preview, { borderColor: colors.border }]}>
          {trimmed ? (
            <BioText markdown={trimmed} />
          ) : (
            <Text style={{ color: colors.textSecondary }}>Nothing to preview yet.</Text>
          )}
        </View>

        <Pressable
          style={[styles.save, { backgroundColor: colors.primary, opacity: saving || !profile ? 0.6 : 1 }]}
          onPress={save}
          disabled={saving || !profile}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={[styles.saveLabel, { color: colors.onPrimary }]}>Save</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, alignItems: 'stretch' },
  link: { alignSelf: 'center', marginTop: 12, marginBottom: 24, fontWeight: '600' },
  label: { fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input: { minHeight: 120, borderRadius: 8, padding: 12, textAlignVertical: 'top', fontSize: 14 },
  hint: { fontSize: 12, marginTop: 6 },
  preview: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 12, minHeight: 48 },
  save: { marginTop: 24, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveLabel: { fontWeight: '600' },
});
