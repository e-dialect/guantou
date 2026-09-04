from datetime import timedelta

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from .models import (
    Concept,
    CuratorGrant,
    Dialect,
    Entry,
    EntrySense,
    EntrySenseConcept,
    EntryWriting,
    EvidenceLink,
    EvidenceRecord,
    PronunciationVariant,
    Recording,
    RecordingEntryLink,
    UsageAttestation,
    WritingForm,
)


class EntryRecordingV2ModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="speaker")
        self.min = Dialect.objects.create(name="闽语", code="min")
        self.puxian = Dialect.objects.create(
            name="莆仙方言",
            code="puxian",
            parent=self.min,
        )

    def make_entry(self, summary, identity_note=""):
        return Entry.objects.create(
            summary=summary,
            identity_note=identity_note,
            usage_dialect=self.puxian,
            created_by=self.user,
        )

    def test_same_writing_can_describe_distinct_entries(self):
        writing = WritingForm.objects.create(
            text="行",
            normalized_text="行",
            form_type=WritingForm.FormType.ORTHOGRAPHIC,
        )
        walking = self.make_entry("行走", "动词，表示步行")
        profession = self.make_entry("行业", "名词，银行的行")
        EntryWriting.objects.create(
            entry=walking,
            writing=writing,
            relation_type=EntryWriting.RelationType.PRIMARY,
        )
        EntryWriting.objects.create(
            entry=profession,
            writing=writing,
            relation_type=EntryWriting.RelationType.PRIMARY,
        )

        self.assertEqual(writing.entries.count(), 2)
        self.assertNotEqual(walking.pk, profession.pk)
        self.assertEqual(str(walking), "行")
        self.assertEqual(str(profession), "行")

    def test_concepts_connect_senses_without_merging_entries(self):
        walk = Concept.objects.create(code="WALK", label="步行")
        run = Concept.objects.create(code="RUN", label="奔跑")
        walking_entry = self.make_entry("步行")
        running_entry = self.make_entry("奔跑")
        walking_sense = EntrySense.objects.create(entry=walking_entry, gloss="走路")
        running_sense = EntrySense.objects.create(entry=running_entry, gloss="跑动")
        EntrySenseConcept.objects.create(sense=walking_sense, concept=walk)
        EntrySenseConcept.objects.create(sense=running_sense, concept=run)

        self.assertEqual(list(walk.senses.all()), [walking_sense])
        self.assertEqual(list(run.senses.all()), [running_sense])
        self.assertNotEqual(walking_entry.pk, running_entry.pk)

    def test_entry_without_recording_is_valid(self):
        entry = self.make_entry("表示害怕的意思")
        EntrySense.objects.create(entry=entry, gloss="害怕")
        writing = WritingForm.objects.create(
            text="惊",
            form_type=WritingForm.FormType.UNCERTAIN,
        )
        EntryWriting.objects.create(
            entry=entry,
            writing=writing,
            relation_type=EntryWriting.RelationType.PRIMARY,
        )

        self.assertFalse(entry.recording_links.exists())
        self.assertEqual(entry.senses.get().gloss, "害怕")
        self.assertEqual(entry.writings.get(), writing)

    def test_recording_links_support_primary_mentions_and_competing_entries(self):
        primary_entry = self.make_entry("走路")
        mentioned_entry = self.make_entry("回家")
        competing_entry = self.make_entry("跑动")
        recording = Recording.objects.create(
            audio_url="https://example.test/recordings/1.mp3",
            usage_dialect=self.puxian,
            recorder=self.user,
            original_gloss="走回家",
        )
        primary = RecordingEntryLink.objects.create(
            recording=recording,
            entry=primary_entry,
            role=RecordingEntryLink.Role.PRIMARY,
            status=RecordingEntryLink.Status.ACCEPTED,
            created_by=self.user,
        )
        mention = RecordingEntryLink.objects.create(
            recording=recording,
            entry=mentioned_entry,
            role=RecordingEntryLink.Role.MENTION,
            status=RecordingEntryLink.Status.ACCEPTED,
            created_by=self.user,
        )
        competing = RecordingEntryLink.objects.create(
            recording=recording,
            entry=competing_entry,
            role=RecordingEntryLink.Role.COMPETING,
            status=RecordingEntryLink.Status.SUGGESTED,
            created_by=self.user,
        )
        second_recording = Recording.objects.create(
            audio_url="https://example.test/recordings/1b.mp3",
            usage_dialect=self.puxian,
            recorder=self.user,
            original_gloss="走",
        )
        RecordingEntryLink.objects.create(
            recording=second_recording,
            entry=primary_entry,
            role=RecordingEntryLink.Role.PRIMARY,
            status=RecordingEntryLink.Status.ACCEPTED,
            created_by=self.user,
        )

        self.assertEqual(
            {primary.role, mention.role, competing.role},
            {"primary", "mention", "competing"},
        )
        self.assertEqual(primary_entry.recording_links.count(), 2)
        with self.assertRaises(IntegrityError), transaction.atomic():
            RecordingEntryLink.objects.create(
                recording=recording,
                entry=competing_entry,
                role=RecordingEntryLink.Role.PRIMARY,
                status=RecordingEntryLink.Status.ACCEPTED,
            )

    def test_linked_sense_must_belong_to_entry(self):
        first_entry = self.make_entry("第一")
        second_entry = self.make_entry("第二")
        second_sense = EntrySense.objects.create(entry=second_entry, gloss="第二义")
        recording = Recording.objects.create(
            audio_url="https://example.test/recordings/2.mp3",
            usage_dialect=self.puxian,
            original_gloss="第一",
        )
        link = RecordingEntryLink(
            recording=recording,
            entry=first_entry,
            sense=second_sense,
        )

        with self.assertRaises(ValidationError):
            link.full_clean()

    def test_evidence_is_append_only_and_reusable_across_claims(self):
        entry = self.make_entry("害怕")
        sense = EntrySense.objects.create(entry=entry, gloss="害怕")
        evidence = EvidenceRecord.objects.create(
            source_type=EvidenceRecord.SourceType.USER_STATEMENT,
            original_text="我这里是表示害怕的意思",
            original_gloss="表示害怕的意思",
            contributor=self.user,
        )
        EvidenceLink.objects.create(evidence=evidence, entry=entry)
        EvidenceLink.objects.create(evidence=evidence, sense=sense)

        evidence.original_text = "整理后的释义"
        with self.assertRaises(ValidationError):
            evidence.save()
        self.assertEqual(evidence.claim_links.count(), 2)

    def test_evidence_link_has_exactly_one_target(self):
        entry = self.make_entry("害怕")
        sense = EntrySense.objects.create(entry=entry, gloss="害怕")
        evidence = EvidenceRecord.objects.create(
            source_type=EvidenceRecord.SourceType.USER_STATEMENT,
            original_gloss="害怕",
        )

        with self.assertRaises(ValidationError):
            EvidenceLink(evidence=evidence).full_clean()
        with self.assertRaises(ValidationError):
            EvidenceLink(evidence=evidence, entry=entry, sense=sense).full_clean()

    def test_parent_dialect_attestation_does_not_expand_to_children(self):
        entry = self.make_entry("本地说法")
        child = Dialect.objects.create(name="莆田", code="putian", parent=self.puxian)
        UsageAttestation.objects.create(
            entry=entry,
            dialect=self.puxian,
            attester=self.user,
        )

        self.assertEqual(entry.usage_attestations.get().dialect, self.puxian)
        self.assertFalse(entry.usage_attestations.filter(dialect=child).exists())
        with self.assertRaises(IntegrityError), transaction.atomic():
            UsageAttestation.objects.create(
                entry=entry,
                dialect=self.puxian,
                attester=self.user,
            )

    def test_pronunciation_requires_a_transcription(self):
        variant = PronunciationVariant(entry=self.make_entry("走"), dialect=self.puxian)

        with self.assertRaises(ValidationError):
            variant.full_clean()

    def test_recording_rejects_device_location_metadata(self):
        recording = Recording(
            audio_url="https://example.test/recordings/3.mp3",
            usage_dialect=self.puxian,
            original_gloss="走",
            metadata={"latitude": 25.4, "device": "phone"},
        )

        with self.assertRaises(ValidationError):
            recording.full_clean()

    def test_curator_grants_are_temporary_and_role_scoped(self):
        now = timezone.now()
        lexical = CuratorGrant(
            user=self.user,
            role=CuratorGrant.Role.LEXICAL,
            valid_from=now,
            valid_until=now + timedelta(days=365),
            reason="有稳定的词条考据贡献",
        )
        lexical.full_clean()
        self.assertTrue(lexical.is_active)

        regional_without_scope = CuratorGrant(
            user=self.user,
            role=CuratorGrant.Role.REGIONAL,
            valid_from=now,
            valid_until=now + timedelta(days=365),
            reason="熟悉本地方言",
        )
        with self.assertRaises(ValidationError):
            regional_without_scope.full_clean()

        lexical_with_scope = CuratorGrant(
            user=self.user,
            role=CuratorGrant.Role.LEXICAL,
            dialect=self.puxian,
            valid_from=now,
            valid_until=now + timedelta(days=365),
            reason="错误范围",
        )
        with self.assertRaises(ValidationError):
            lexical_with_scope.full_clean()
