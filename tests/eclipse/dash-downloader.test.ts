import { describe, expect, it } from 'vitest';
import {
    isDashManifest,
    unescapeXml,
    parseDashMpd,
    parseRepresentations,
    buildSegmentUrl,
    extractFlacHeaderFromInitSegment,
    extractMdatPayload,
    extractFlacFromDashSegments,
    verifyFlacInitSegment,
    verifyFlacMediaSegment,
    createMockStreamInfo,
} from '@/services/eclipse/dashDownloader';

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

    const multiRepMpdXml = `<?xml version='1.0' encoding='UTF-8'?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011">
  <Period>
    <AdaptationSet id="0" contentType="audio" mimeType="audio/mp4">
      <SegmentTemplate timescale="48000" initialization="https://audio.tidal.com/$RepresentationID$/0.mp4?token=abc" media="https://audio.tidal.com/$RepresentationID$/$Number$.mp4?token=abc" startNumber="1">
        <SegmentTimeline>
          <S d="192000" r="5"/>
        </SegmentTimeline>
      </SegmentTemplate>
      <Representation id="AAC_320" codecs="mp4a.40.2" bandwidth="320000" audioSamplingRate="44100" />
      <Representation id="FLAC_LOSSLESS,44100,16" codecs="flac" bandwidth="900000" audioSamplingRate="44100" />
      <Representation id="FLAC_HIRES,48000,24" codecs="flac" bandwidth="1792546" audioSamplingRate="48000" />
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

    it('selects highest quality FLAC Hi-Res representation and resolves $RepresentationID$', () => {
        const baseUrl = 'https://audio.tidal.com/master.mpd';
        const parsed = parseDashMpd(multiRepMpdXml, baseUrl);

        // Should select the 24-bit Hi-Res representation over AAC and 16-bit FLAC
        expect(parsed.selectedRepresentation.id).toBe('FLAC_HIRES,48000,24');
        expect(parsed.selectedRepresentation.bitDepth).toBe(24);
        expect(parsed.selectedRepresentation.audioSamplingRate).toBe(48000);

        // Should replace $RepresentationID$ in URLs
        expect(parsed.initUrl).toBe('https://audio.tidal.com/FLAC_HIRES,48000,24/0.mp4?token=abc');
        expect(parsed.mediaUrlTemplate).toBe('https://audio.tidal.com/FLAC_HIRES,48000,24/$Number$.mp4?token=abc');
        expect(parsed.segmentNumbers.length).toBe(6);
    });

    it('verifies genuine 24-bit / 48kHz and 96kHz FLAC STREAMINFO in init segment', () => {
        // Construct mock MP4 container with dfLa box carrying authentic STREAMINFO
        const streamInfoData = createMockStreamInfo({
            sampleRate: 48000,
            channels: 2,
            bitsPerSample: 24,
            totalSamples: BigInt(5000000),
        });

        // dfLa box: 4B size, 4B 'dfLa', 4B version/flags, 4B meta header (0x00 blockType=STREAMINFO, 34B len), 34B data
        const metaBlockHeader = Buffer.from([0x00, 0x00, 0x00, 34]);
        const dfLaPayload = Buffer.concat([metaBlockHeader, streamInfoData]);
        const dfLaBox = Buffer.concat([
            Buffer.from([0, 0, 0, 4 + 4 + 4 + dfLaPayload.length]),
            Buffer.from('dfLa', 'ascii'),
            Buffer.from([0, 0, 0, 0]),
            dfLaPayload,
        ]);
        const initSegment = Buffer.concat([Buffer.alloc(16), dfLaBox]);

        const verified = verifyFlacInitSegment(initSegment, {
            id: 'FLAC_HIRES,48000,24',
            codecs: 'flac',
            mimeType: 'audio/mp4',
            bandwidth: 1792546,
            audioSamplingRate: 48000,
            bitDepth: 24,
        });

        expect(verified.sampleRate).toBe(48000);
        expect(verified.channels).toBe(2);
        expect(verified.bitsPerSample).toBe(24);
        expect(verified.isHiRes).toBe(true);
        expect(verified.flacHeader.subarray(0, 4).toString('ascii')).toBe('fLaC');
        // Last metadata block flag should be set
        expect(verified.flacHeader[4] & 0x80).toBe(0x80);
    });

    it('throws error when STREAMINFO does not match expected representation', () => {
        const streamInfoData = createMockStreamInfo({
            sampleRate: 44100,
            channels: 2,
            bitsPerSample: 16,
        });

        const metaBlockHeader = Buffer.from([0x00, 0x00, 0x00, 34]);
        const dfLaPayload = Buffer.concat([metaBlockHeader, streamInfoData]);
        const dfLaBox = Buffer.concat([
            Buffer.from([0, 0, 0, 4 + 4 + 4 + dfLaPayload.length]),
            Buffer.from('dfLa', 'ascii'),
            Buffer.from([0, 0, 0, 0]),
            dfLaPayload,
        ]);
        const initSegment = Buffer.concat([Buffer.alloc(16), dfLaBox]);

        expect(() => {
            verifyFlacInitSegment(initSegment, {
                id: 'FLAC_HIRES,48000,24',
                codecs: 'flac',
                mimeType: 'audio/mp4',
                bandwidth: 1792546,
                audioSamplingRate: 48000,
                bitDepth: 24,
            });
        }).toThrow(/sample rate/i);
    });

    it('verifies media segments contain genuine FLAC frame sync codes (0xFFF8/0xFFF9)', () => {
        // Valid FLAC frame sync code 0xFFF8
        const validFlacFrame = Buffer.from([0xff, 0xf8, 0x12, 0x34, 0x56, 0x78]);
        const validMdat = Buffer.concat([
            Buffer.from([0, 0, 0, 8 + validFlacFrame.length]),
            Buffer.from('mdat', 'ascii'),
            validFlacFrame,
        ]);

        const verified = verifyFlacMediaSegment(validMdat, 1);
        expect(verified).toEqual(validFlacFrame);

        // Corrupted media data without FLAC sync code
        const fakeAudioData = Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55]);
        const fakeMdat = Buffer.concat([
            Buffer.from([0, 0, 0, 8 + fakeAudioData.length]),
            Buffer.from('mdat', 'ascii'),
            fakeAudioData,
        ]);

        expect(() => {
            verifyFlacMediaSegment(fakeMdat, 1);
        }).toThrow(/does not correspond to genuine FLAC frame/i);
    });

    it('extracts lossless FLAC header from MP4 dfLa box without FFmpeg', () => {
        const ftyp = Buffer.from([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x36, 0, 0, 0, 0]);
        const flacMetadataPayload = Buffer.concat([
            Buffer.from('fLaC', 'ascii'),
            Buffer.alloc(38, 0x42),
        ]);
        const dfLaBox = Buffer.concat([
            Buffer.from([0, 0, 0, 4 + 4 + 4 + flacMetadataPayload.length]),
            Buffer.from('dfLa', 'ascii'),
            Buffer.from([0, 0, 0, 0]),
            flacMetadataPayload,
        ]);
        const initSegment = Buffer.concat([ftyp, dfLaBox]);

        const header = extractFlacHeaderFromInitSegment(initSegment);
        expect(header).not.toBeNull();
        expect(header!.subarray(0, 4).toString('ascii')).toBe('fLaC');
        expect(header!.length).toBe(42);
    });

    it('extracts raw audio frames from media segment mdat boxes without FFmpeg re-encoding', () => {
        const frameData = Buffer.from([0xff, 0xf8, 0x12, 0x34, 0x56, 0x78]);
        const mdatBox = Buffer.concat([
            Buffer.from([0, 0, 0, 8 + frameData.length]),
            Buffer.from('mdat', 'ascii'),
            frameData,
        ]);

        const extracted = extractMdatPayload(mdatBox);
        expect(extracted).toEqual(frameData);
    });

    it('stitches pure lossless FLAC file from DASH init and media segments', () => {
        const flacMetadataPayload = Buffer.concat([
            Buffer.from('fLaC', 'ascii'),
            Buffer.alloc(38, 0x01),
        ]);
        const dfLaBox = Buffer.concat([
            Buffer.from([0, 0, 0, 4 + 4 + 4 + flacMetadataPayload.length]),
            Buffer.from('dfLa', 'ascii'),
            Buffer.from([0, 0, 0, 0]),
            flacMetadataPayload,
        ]);
        const initSegment = Buffer.concat([Buffer.alloc(16), dfLaBox]);

        const frame1 = Buffer.from([0xff, 0xf8, 0xaa, 0xbb]);
        const mdat1 = Buffer.concat([Buffer.from([0, 0, 0, 12]), Buffer.from('mdat', 'ascii'), frame1]);

        const frame2 = Buffer.from([0xff, 0xf8, 0xcc, 0xdd]);
        const mdat2 = Buffer.concat([Buffer.from([0, 0, 0, 12]), Buffer.from('mdat', 'ascii'), frame2]);

        const fullFlac = extractFlacFromDashSegments(initSegment, [mdat1, mdat2]);
        expect(fullFlac.subarray(0, 4).toString('ascii')).toBe('fLaC');
        expect(fullFlac.length).toBe(42 + frame1.length + frame2.length);
        expect(fullFlac.subarray(42, 46)).toEqual(frame1);
        expect(fullFlac.subarray(46, 50)).toEqual(frame2);
    });
});
