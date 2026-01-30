import { Linking, Alert } from 'react-native';

export const sendWhatsAppMessage = (phone, message) => {
    if (!phone) {
        Alert.alert("Error", "Phone number nahi mila!");
        return;
    }

    // Phone number se faltu characters hatane ke liye
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    
    // WhatsApp URL (91 India ka code hai)
    const url = `whatsapp://send?text=${encodeURIComponent(message)}&phone=91${cleanPhone}`;

    Linking.canOpenURL(url)
        .then((supported) => {
            if (supported) {
                return Linking.openURL(url);
            } else {
                // Agar WhatsApp install nahi hai toh browser wala link try karein
                const browserUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
                return Linking.openURL(browserUrl);
            }
        })
        .catch((err) => Alert.alert("Error", "WhatsApp kholne mein dikkat aayi"));
};