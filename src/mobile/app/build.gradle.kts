plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    // JVM screenshot tests of the UI: gradlew recordPaparazziDebug
    id("app.cash.paparazzi")
}

android {
    namespace = "com.focusflip.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.focusflip.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0-beta"

        // Shared Fishtank Supabase project (same values as fishtank/src/db.js).
        buildConfigField("String", "SUPABASE_URL", "\"https://aakaelrvybduqijgermo.supabase.co\"")
        buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", "\"sb_publishable_A6CBnknUmf150g2eQ9ddew_oYSVlsEt\"")
        // Offline mock accounts + fake sync. Production uses the shared database.
        buildConfigField("boolean", "USE_MOCK_BACKEND", "false")
        // Shows the developer "force unlock" button and fast timers toggle.
        buildConfigField("boolean", "DEV_TOOLS", "true")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Beta builds are signed with the debug key so they can be sideloaded easily.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.03")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
