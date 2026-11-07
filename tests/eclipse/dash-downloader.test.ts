import { describe, expect, it } from 'vitest';
import { isDashManifest, unescapeXml, parseDashMpd, buildSegmentUrl } from '@/services/eclipse/dashDownloader';

describe('Eclipse DASH Audio Downloader', () => {
    const sampleMpdXml = `<?xml version='1.0' encoding='UTF-8'?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:cenc="urn:mpeg:cenc:2013" xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd" profiles="urn:mpeg:dash:profile:isoff-main:2011" type="static" minBufferTime="PT3.925S" mediaPresentationDuration="PT2M34.376S">
  <Period id="0">
    <AdaptationSet id="0" contentType="audio" mimeType="audio/mp4" lang="und" group="main" segmentAlignment="true">
      <Role schemeIdUri="urn:mpeg:dash:role:2011" value="main"/>
      <Representation id="FLAC_HIRES,48000,24" codecs="flac" bandwidth="1792546" audioSamplingRate="48000">
        <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="2"/>
        <SegmentTemplate timescale="48000" initialization="https://sp-ad-cf.audio.tidal.com/mediatracks/GigIAxIkYzgxOTk2ZWFmMTE5Mzg3MTNlODM5NTRiODcwMjRjMTYubXA0IhsdAACAQCACKhA37bVIC1yj7Hrl8s37c6TIMgA/0.mp4?Policy=eyJTdGF0...&amp;Signature=Vwww...&amp;Key-Pair-Id=K14LZCZ9QUI4JL" media="https://sp-ad-cf.audio.tidal.com/mediatracks/GigIAxIkYzgxOTk2ZWFmMTE5Mzg3MTNlODM5NTRiODcwMjRjMTYubXA0IhsdAACAQCACKhA37bVIC1yj7Hrl8s37c6TIMgA/$Number$.mp4?Policy=eyJTdGF0...&amp;Signature=Vwww...&amp;Key-Pair-Id=K14LZCZ9QUI4JL" startNumber="1">
          <SegmentTimeline>
            <S d="188416" r="38"/>
            <S d="61826"/>
          </SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

    it('identifies DASH manifest correctly', () => {
        expect(isDashManifest('https://example.com/manifest.mpd?Expires=123')).toBe(true);
        expect(isDashManifest(sampleMpdXml)).toBe(true);
        expect(isDashManifest('https://example.com/song.flac')).toBe(false);
        expect(isDashManifest('some random string', 'application/dash+xml')).toBe(true);
    });

    it('unescapes XML entities in manifest URLs', () => {
        const escaped = 'https://audio.example.com/seg.mp4?a=1&amp;b=2&amp;c=3';
        expect(unescapeXml(escaped)).toBe('https://audio.example.com/seg.mp4?a=1&b=2&c=3');
    });

    it('parses DASH MPD and generates exact segment list and init URL', () => {
        const baseUrl = 'https://im-cf.manifest.tidal.com/1/manifests/test.mpd';
        const parsed = parseDashMpd(sampleMpdXml, baseUrl);

        expect(parsed.codecs).toBe('flac');
        expect(parsed.timescale).toBe(48000);
        expect(parsed.startNumber).toBe(1);
        expect(parsed.initUrl).toContain('0.mp4?Policy=eyJTdGF0...&Signature=Vwww...&Key-Pair-Id=K14LZCZ9QUI4JL');
        expect(parsed.initUrl).not.toContain('&amp;');

        // 1 + 38 = 39 segments from first <S>, plus 1 from second <S> = 40 total
        expect(parsed.segmentNumbers.length).toBe(40);
        expect(parsed.segmentNumbers[0]).toBe(1);
        expect(parsed.segmentNumbers[38]).toBe(39);
        expect(parsed.segmentNumbers[39]).toBe(40);

        // Test building segment URLs
        const seg1Url = buildSegmentUrl(parsed.mediaUrlTemplate, 1, baseUrl);
        expect(seg1Url).toContain('/1.mp4?');
        expect(seg1Url).not.toContain('$Number$');

        const seg40Url = buildSegmentUrl(parsed.mediaUrlTemplate, 40, baseUrl);
        expect(seg40Url).toContain('/40.mp4?');
    });
});
