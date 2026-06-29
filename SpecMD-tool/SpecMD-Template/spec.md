# GoldenNote Directory

> **SpecMD v4 — React Web App**
> React 18 · Vite 5 · TypeScript 5 · Tailwind CSS · TanStack Query v5 · React Router v6 · Zustand

---

## 1. App Overview

### 1.1 What it does
An entertainment directory website where bands showcase their bios, audio samples, and YouTube videos, while advertisers register to display targeted promotional campaigns. Users can seamlessly browse bands, play music, watch videos, and view dynamic advertisements.

### 1.2 Primary user
Band members who want to promote their music and advertisers looking to reach music enthusiasts with targeted ads.

### 1.3 Success metric
An increase in active band profiles and advertisement click-through rates (CTR) tracked via the advertiser dashboard.

### 1.4 Out of scope
- Direct ticket sales processing
- Real-time chat between users and bands
- Audio file hosting (uses external links instead)
- Actual credit card payment gateway for advertisers (uses mock budget allocation)

---

## 2. Pages & Routes

| Route | Page component | Description | Auth |
|-------|---------------|-------------|------|
| `/` | `HomePage` | Public directory of bands with search, genre filters, featured bands, and dynamic banner advertisements. | no |
| `/bands/:id` | `BandDetailPage` | Detailed band profile showing bio, media gallery, embedded YouTube video player, audio sample player, and sidebar advertisements. | no |
| `/login` | `LoginPage` | Unified login page for bands and advertisers to access their respective dashboards. | no |
| `/register` | `RegisterPage` | Registration page allowing users to sign up as either a Band or an Advertiser. | no |
| `/band-dashboard` | `BandDashboardPage` | Dashboard for band members to update their bio, upload media links, manage YouTube embeds, and view profile visit analytics. | yes |
| `/advertiser-dashboard` | `AdvertiserDashboardPage` | Dashboard for advertisers to create campaigns, upload ad banners, set budgets, and view impression/click analytics. | yes |

---

## 3. Features

### Feature: `Band Directory Search & Filter`

- **Page**: `HomePage`
- **User story**:

  ```
  Given a visitor on the home page, when they search for a band name or filter by genre, then the band grid updates instantly to show matching profiles.
  ```
- **Data reads**: useBandsQuery (all bands)
- **Data writes**: None
- **Edge cases**: No bands found for the selected genre shows a friendly 'No bands found' empty state with a reset button.
- **UI to render**: Grid(3 columns of Band Cards with image, genre, location, and 'View Profile' button) | SearchBar(input: search text) | FilterDropdown(genres: Rock, Jazz, Indie, Metal, Pop, Electronic)

### Feature: `Band Media Showcase`

- **Page**: `BandDetailPage`
- **User story**:

  ```
  Given a visitor viewing a band's profile, when they click play on the audio sample or watch the YouTube video, then the media plays directly on the page.
  ```
- **Data reads**: useBandDetailQuery(id)
- **Data writes**: incrementBandViewsMutation(id)
- **Edge cases**: Invalid YouTube URL displays a placeholder warning; missing audio sample hides the audio player section.
- **UI to render**: AudioPlayer(HTML5 audio element with custom play/pause/progress styled in dark goldenrod) | VideoEmbed(iframe for YouTube video) | StatCard(label: Profile Views, value: views count) | ContactButton(opens mailto link)

### Feature: `Dynamic Advertisement Rotation`

- **Page**: `HomePage`
- **User story**:

  ```
  Given a visitor browsing the directory, when they load a page, then active advertisements are dynamically displayed in designated banner slots and track impressions.
  ```
- **Data reads**: useActiveAdsQuery
- **Data writes**: trackAdImpressionMutation(adId), trackAdClickMutation(adId)
- **Edge cases**: If no active ads exist, a default self-promotion banner for 'Advertise with Us' is shown.
- **UI to render**: BannerAd(image, title, external link, tracks click on press) | SidebarAd(square banner format)

### Feature: `Band Profile Management`

- **Page**: `BandDashboardPage`
- **User story**:

  ```
  Given a logged-in band member, when they edit their bio, image URL, audio sample link, or YouTube link and save, then their public profile is updated instantly.
  ```
- **Data reads**: useMyBandProfileQuery
- **Data writes**: updateBandProfileMutation(fields)
- **Edge cases**: Validates that YouTube links match standard youtube.com/watch or youtu.be formats using Zod.
- **UI to render**: Form(fields: bandName text, genre select, bio textarea, imageUrl text, audioUrl text, youtubeUrl text, location text, contactEmail email) | StatCard×3 (totalViews, totalLikes, profileCompleteness)

### Feature: `Advertiser Campaign Manager`

- **Page**: `AdvertiserDashboardPage`
- **User story**:

  ```
  Given a logged-in advertiser, when they fill out the ad creation form with a banner image and budget, then a new campaign is created and added to their active list.
  ```
- **Data reads**: useMyAdsQuery, useAdAnalyticsQuery
- **Data writes**: createAdMutation(fields), toggleAdStatusMutation(adId)
- **Edge cases**: If budget is set to 0, the ad status automatically shifts to 'paused'.
- **UI to render**: Form(fields: title text, imageUrl text, targetUrl text, budget number) | DataTable(cols: title, status active/paused, budget, impressions, clicks, CTR percent, actions toggle/delete) | LineChart(X=date, Y=impressions & clicks, 7 days of historical data)

---

## 4. Data Types

```typescript
export interface User {
  id: string;
  email: string;
  role: 'band' | 'advertiser';
  name: string;
}

export interface BandProfile {
  id: string;
  userId: string;
  name: string;
  genre: 'Rock' | 'Jazz' | 'Indie' | 'Metal' | 'Pop' | 'Electronic';
  bio: string;
  imageUrl: string;
  audioUrl: string;
  youtubeUrl: string;
  location: string;
  contactEmail: string;
  views: number;
  likes: number;
}

export interface Advertisement {
  id: string;
  advertiserId: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  impressions: number;
  clicks: number;
  status: 'active' | 'paused';
  budget: number;
}

export interface AdAnalytics {
  date: string;
  impressions: number;
  clicks: number;
}

export interface ApiError {
  code: string;
  message: string;
}
```

---

## 5. API / Data Layer

**Mock data**

Generates 12 realistic band profiles across various genres with actual royalty-free audio URLs (e.g., from archive.org or direct mp3 links) and valid YouTube embed codes. Generates 6 realistic advertisements for music stores, recording studios, and local venues, complete with historical impression and click data spanning the last 7 days for the analytics charts.

---

## 6. UI Constraints

- **Layout pattern**: sidebar
- **Color scheme**: background: floral white #FFFAF0, primary: dark goldenrod #B8860B, secondary: warm charcoal #2D2D2D, accent: soft gold #DAA520
- **Primary colour**: #B8860B
- **Secondary**: #2D2D2D
- **Typography**: Georgia, serif
- **Layout notes**: The application features a persistent top navigation bar with branding, search, and user profile controls. On directory pages, a right-hand sidebar displays active advertisements. Dashboards utilize a clean left-sidebar navigation layout for quick switching between profile editing, campaign management, and analytics views.
- **Accessibility**: Ensure high contrast between dark goldenrod elements and the floral white background. Provide alternative text for all band images and advertisement banners. Ensure the custom audio player controls are fully keyboard navigable and have appropriate aria-labels.

---

## 7. Anti-Requirements

- MUST NOT require real credit card processing or payment gateways.
- MUST NOT host audio files directly; must rely on external URL links.
- MUST NOT allow advertisers to edit band profiles or vice versa.
