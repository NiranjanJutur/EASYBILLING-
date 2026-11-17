import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { launchCamera } from 'react-native-image-picker';

export default function CustomerCamera({ visible, onClose, onCaptured }: {
  visible: boolean;
  onClose: () => void;
  onCaptured: (uri: string) => void;
}) {
  const launched = useRef(false);

  useEffect(() => {
    if (!visible) {
      launched.current = false;
      return;
    }
    if (launched.current) return;
    launched.current = true;

    launchCamera({ mediaType: 'photo', quality: 0.8, saveToPhotos: false })
      .then(response => {
        if (response.didCancel) {
          onClose();
          return;
        }
        if (response.errorCode) {
          throw new Error(response.errorMessage || 'Could not open the camera.');
        }
        const uri = response.assets?.[0]?.uri;
        if (!uri) throw new Error('No photo was captured.');
        onCaptured(uri);
      })
      .catch(error => {
        Alert.alert('Camera error', error instanceof Error ? error.message : 'Could not capture the photo.');
        onClose();
      });
  }, [visible, onClose, onCaptured]);

  return null;
}
