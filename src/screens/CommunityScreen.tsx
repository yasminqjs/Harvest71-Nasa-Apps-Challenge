import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLanguage } from '../i18n/Language';
import { Pressable, Text, TextInput } from '../i18n/native';
import { CommunityReportGraph } from '../components/CommunityReportGraph';
import { FeatureBadge } from '../components/FeatureBadge';
import { VoiceReadBar } from '../components/VoiceReadBar';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  TOPIC_META,
  buildCommunityReportGraph,
} from '../data/communityMockData';
import { FEATURE_COLOR_STYLES } from '../models/farmArchitecture';
import { getAppTheme } from '../theme/tokens';
import { CommunityTopic } from '../types/domain';

/**
 * Aba Comunidade ("O que o usuário vê" -> aba comunidade):
 * - AZUL:   Relatar acontecimentos (pragas, mudanças de preço, desastres naturais)
 * - SALMÃO: Ver usuários próximos + Receber relatos de outros usuários
 */
export const CommunityScreen: React.FC = () => {
  const {
    accessibility,
    activeFarmer,
    activeFarm,
    communityPosts: posts,
    addCommunityPost,
    toggleCommunityLike,
    addCommunityReply,
    speak,
  } = useAccessibility();
  const { language } = useLanguage();
  const en = language === 'en';
  const theme = getAppTheme(accessibility);
  const blue = FEATURE_COLOR_STYLES.azul;
  const salmon = FEATURE_COLOR_STYLES.salmao;
  const autoSpokenRef = useRef(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState<CommunityTopic | 'todos'>('todos');

  // Feature AZUL: relatar acontecimentos (pragas, mudanças de preço, desastres naturais)
  const [composerOpen, setComposerOpen] = useState(false);
  const [postTipo, setPostTipo] = useState<'pergunta' | 'relato'>('relato');
  const [postTopico, setPostTopico] = useState<CommunityTopic>('praga');
  const [postTitulo, setPostTitulo] = useState('');
  const [postMensagem, setPostMensagem] = useState('');

  // Respostas inline
  const [openThreadId, setOpenThreadId] = useState<string | null>(posts[0]?.id ?? null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const graph = useMemo(
    () => (activeFarm ? buildCommunityReportGraph(posts, activeFarm) : { nodes: [], edges: [] }),
    [posts, activeFarm]
  );

  const selectedGraphNode =
    graph.nodes.find((n) => n.id === selectedNodeId) ?? null;

  const filteredPosts = posts.filter((post) => {
    if (topicFilter !== 'todos' && post.topico !== topicFilter) return false;
    if (selectedGraphNode) {
      return (
        post.municipio === selectedGraphNode.municipio &&
        post.estado === selectedGraphNode.estado
      );
    }
    return true;
  });

  const communityVoiceText = useMemo(() => {
    if (!activeFarm) return '';
    const nearbyCount = Math.max(0, graph.nodes.length - 1);
    const headlines = filteredPosts
      .slice(0, 3)
      .map((p) => `${p.autor} de ${p.municipio}: ${p.titulo}. ${p.mensagem}`)
      .join(' ');
    if (en) {
      return `Community tab for ${activeFarm.regiaoNome}. ${filteredPosts.length} local reports shown across ${nearbyCount} nearby poles. ${headlines}`;
    }
    return `Aba Comunidade de ${activeFarm.regiaoNome}. Exibindo ${filteredPosts.length} relatos entre ${nearbyCount} polos próximos. ${headlines}`;
  }, [activeFarm, en, filteredPosts, graph.nodes.length]);

  useEffect(() => {
    if (!accessibility.voiceGuidanceEnabled || autoSpokenRef.current || !communityVoiceText) return;
    autoSpokenRef.current = true;
    speak(communityVoiceText);
  }, [accessibility.voiceGuidanceEnabled, communityVoiceText, speak]);

  if (!activeFarm || !activeFarmer) return null;

  const handleCreatePost = () => {
    const cleanTitle = postTitulo.trim();
    const cleanMsg = postMensagem.trim();
    if (!cleanTitle || !cleanMsg) return;

    const created = addCommunityPost({
      tipo: postTipo,
      topico: postTopico,
      titulo: cleanTitle,
      mensagem: cleanMsg,
    });
    if (!created) return;

    setPostTitulo('');
    setPostMensagem('');
    setComposerOpen(false);
    setSelectedNodeId(null);
    setTopicFilter('todos');
    setOpenThreadId(created.id);
    speak(`Seu relato de acontecimento foi salvo na comunidade de ${activeFarm.regiaoNome}.`, true);
  };

  const handleToggleLike = (postId: string) => {
    toggleCommunityLike(postId);
  };

  const handleSendReply = (postId: string) => {
    const text = (replyDrafts[postId] ?? '').trim();
    if (!text) return;
    addCommunityReply(postId, text);
    setReplyDrafts((prev) => ({ ...prev, [postId]: '' }));
    speak('Resposta enviada para a comunidade.', true);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.container}
    >
      {/* Cabeçalho Comunidade + Ação AZUL */}
      <View
        style={[
          styles.heroCard,
          { backgroundColor: theme.surface, borderColor: blue.border },
        ]}
      >
        <View style={styles.heroTop}>
          <View style={{ flex: 1, gap: 4 }}>
            <FeatureBadge color="azul" />
            <Text style={[styles.heroTitle, { color: theme.text, fontSize: 19 * theme.scale }]}>
              Comunidade da Roça
            </Text>
            <Text style={{ fontSize: 12, color: theme.textMuted }}>
              Relate acontecimentos locais (pragas, mudanças de preço, desastres naturais) e veja
              usuários próximos no grafo.
            </Text>
          </View>
          <Pressable
            onPress={() =>
              speak(
                `Comunidade da Roça. Existem ${posts.length} acontecimentos e relatos publicados entre ${graph.nodes.length - 1} regiões próximas no grafo.`,
                true
              )
            }
            style={[styles.voiceBtn, { backgroundColor: theme.surfaceMuted }]}
          >
            <Ionicons name="volume-high" size={20} color={theme.primary} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => setComposerOpen((v) => !v)}
          style={[styles.askBtn, { backgroundColor: blue.border }]}
        >
          <Ionicons
            name={composerOpen ? 'close-circle-outline' : 'megaphone-outline'}
            size={20}
            color="#FFFFFF"
          />
          <Text style={{ fontWeight: '900', color: '#FFFFFF', fontSize: 13 }}>
            {composerOpen
              ? 'Fechar formulário'
              : '+ Relatar acontecimento (pragas, preço, desastre)'}
          </Text>
        </Pressable>
      </View>

      <VoiceReadBar
        text={communityVoiceText}
        theme={theme}
        label={en ? 'Read Community tab aloud' : 'Ouvir leitura da aba Comunidade'}
      />

      {/* Formulário AZUL: relatar acontecimentos */}
      {composerOpen && (
        <View
          style={[
            styles.composerCard,
            { backgroundColor: theme.surface, borderColor: '#2563EB' },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Relatar acontecimento ou fazer pergunta
          </Text>

          <View style={styles.rowBtns}>
            {(
              [
                { id: 'relato', label: 'Relato de acontecimento' },
                { id: 'pergunta', label: 'Pergunta para agricultores' },
              ] as const
            ).map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => setPostTipo(opt.id)}
                style={[
                  styles.typeBtn,
                  {
                    backgroundColor: postTipo === opt.id ? '#2563EB' : theme.surfaceMuted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '900',
                    color: postTipo === opt.id ? '#FFFFFF' : theme.text,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.chipWrap}>
            {(Object.keys(TOPIC_META) as CommunityTopic[]).map((top) => {
              const info = TOPIC_META[top];
              const active = postTopico === top;
              return (
                <Pressable
                  key={top}
                  onPress={() => setPostTopico(top)}
                  style={[
                    styles.topicChip,
                    {
                      backgroundColor: active ? info.color : theme.surfaceMuted,
                      borderColor: info.color,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: active ? '#FFFFFF' : theme.text,
                    }}
                  >
                    {info.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={postTitulo}
            onChangeText={setPostTitulo}
            placeholder="Título resumido (ex.: Dúvida sobre sorgo no veranico)"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
            ]}
          />
          <TextInput
            value={postMensagem}
            onChangeText={setPostMensagem}
            placeholder="Escreva sua pergunta ou conte o que observou no seu lote..."
            placeholderTextColor={theme.textMuted}
            multiline
            style={[
              styles.input,
              {
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.text,
                minHeight: 72,
              },
            ]}
          />

          <Pressable
            onPress={handleCreatePost}
            style={[styles.publishBtn, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="send" size={18} color={theme.primaryText} />
            <Text style={{ fontWeight: '900', color: theme.primaryText }}>
              Publicar na Comunidade
            </Text>
          </Pressable>
        </View>
      )}

      {/* Seção SALMÃO: Ver usuários próximos + Receber relatos de outros usuários */}
      <View
        style={[
          styles.heroCard,
          { backgroundColor: salmon.bg, borderColor: salmon.border, paddingVertical: 10 },
        ]}
      >
        <FeatureBadge color="salmao" />
        <Text style={{ fontSize: 12, fontWeight: '800', color: salmon.text }}>
          Ver usuários próximos ({graph.nodes.filter((n) => !n.isUserFarm).length} polos) e receber
          relatos de outros usuários na sua região
        </Text>
      </View>

      {/* Sistema de Grafo de Relatos Regionais (Ver usuários próximos) */}
      <CommunityReportGraph
        nodes={graph.nodes}
        edges={graph.edges}
        selectedNodeId={selectedNodeId}
        onSelectNode={(id) => setSelectedNodeId(id)}
        theme={theme}
      />

      {/* Filtros por tópico */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        <Pressable
          onPress={() => setTopicFilter('todos')}
          style={[
            styles.topicChip,
            {
              backgroundColor: topicFilter === 'todos' ? theme.primary : theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '800',
              color: topicFilter === 'todos' ? theme.primaryText : theme.text,
            }}
          >
            Todos ({posts.length})
          </Text>
        </Pressable>
        {(Object.keys(TOPIC_META) as CommunityTopic[]).map((top) => {
          const info = TOPIC_META[top];
          const active = topicFilter === top;
          return (
            <Pressable
              key={`flt-${top}`}
              onPress={() => setTopicFilter(top)}
              style={[
                styles.topicChip,
                {
                  backgroundColor: active ? info.color : theme.surface,
                  borderColor: info.color,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: active ? '#FFFFFF' : theme.text,
                }}
              >
                {info.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Feed de perguntas e relatos */}
      {filteredPosts.length === 0 ? (
        <View
          style={[
            styles.emptyBox,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textMuted }}>
            Nenhuma publicação encontrada com este filtro.
          </Text>
        </View>
      ) : (
        filteredPosts.map((post) => {
          const tMeta = TOPIC_META[post.topico];
          const isThreadOpen = openThreadId === post.id;
          return (
            <View
              key={post.id}
              style={[
                styles.postCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.postHeader}>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.badgeRow}>
                    <View style={[styles.badgePill, { backgroundColor: tMeta.bg }]}>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: tMeta.color }}>
                        {tMeta.label}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badgePill,
                        {
                          backgroundColor:
                            post.tipo === 'pergunta' ? '#EFF6FF' : theme.successBg,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '900',
                          color: post.tipo === 'pergunta' ? '#1D4ED8' : theme.successText,
                        }}
                      >
                        {post.tipo === 'pergunta' ? 'Pergunta' : 'Relato'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10.5, color: theme.textMuted }}>
                      {post.haQuantoTempo}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: theme.textMuted }}>
                    {post.autor} • 📍 {post.municipio} - {post.estado} ({post.regiaoNome})
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    speak(
                      `${post.autor}, de ${post.municipio}, pergunta ou relata: ${post.titulo}. ${post.mensagem}`,
                      true
                    )
                  }
                  style={[styles.listenMini, { backgroundColor: theme.surfaceMuted }]}
                >
                  <Ionicons name="volume-high" size={16} color={theme.primary} />
                </Pressable>
              </View>

              <Text style={[styles.postTitle, { color: theme.text }]}>{post.titulo}</Text>
              <Text style={[styles.postBody, { color: theme.text }]}>{post.mensagem}</Text>

              <View style={styles.postActions}>
                <Pressable
                  onPress={() => handleToggleLike(post.id)}
                  style={[
                    styles.actionChip,
                    {
                      backgroundColor: post.curtidoPorMim
                        ? theme.successBg
                        : theme.surfaceMuted,
                      borderColor: post.curtidoPorMim ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={post.curtidoPorMim ? 'thumbs-up' : 'thumbs-up-outline'}
                    size={15}
                    color={post.curtidoPorMim ? theme.primary : theme.text}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: post.curtidoPorMim ? theme.primary : theme.text,
                    }}
                  >
                    Ajudou ({post.curtidas})
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setOpenThreadId(isThreadOpen ? null : post.id)}
                  style={[
                    styles.actionChip,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}
                >
                  <Ionicons name="chatbubble-outline" size={15} color={theme.text} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
                    Respostas ({post.respostas.length})
                  </Text>
                </Pressable>
              </View>

              {isThreadOpen && (
                <View style={[styles.threadBox, { borderTopColor: theme.border }]}>
                  {post.respostas.map((rep) => (
                    <View
                      key={rep.id}
                      style={[
                        styles.replyItem,
                        { backgroundColor: theme.bg, borderColor: theme.border },
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '900', color: theme.primary }}>
                        {rep.autor} ({rep.municipio}) • {rep.criadoEm}
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.text, lineHeight: 17 }}>
                        {rep.texto}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.replyComposerRow}>
                    <TextInput
                      value={replyDrafts[post.id] ?? ''}
                      onChangeText={(txt) =>
                        setReplyDrafts((prev) => ({ ...prev, [post.id]: txt }))
                      }
                      placeholder="Escreva uma resposta ou dica..."
                      placeholderTextColor={theme.textMuted}
                      style={[
                        styles.replyInput,
                        {
                          backgroundColor: theme.bg,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                    />
                    <Pressable
                      onPress={() => handleSendReply(post.id)}
                      style={[styles.replySendBtn, { backgroundColor: theme.primary }]}
                    >
                      <Ionicons name="send" size={16} color={theme.primaryText} />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 14, gap: 12, paddingBottom: 28 },
  heroCard: { borderRadius: 20, borderWidth: 2, padding: 14, gap: 10 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heroTitle: { fontWeight: '900' },
  voiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askBtn: {
    minHeight: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  composerCard: { borderRadius: 18, borderWidth: 2, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '900' },
  rowBtns: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  topicChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  publishBtn: {
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  filterScroll: { gap: 8, paddingVertical: 2 },
  emptyBox: { borderRadius: 16, borderWidth: 1.5, padding: 18, alignItems: 'center' },
  postCard: { borderRadius: 18, borderWidth: 1.5, padding: 14, gap: 8 },
  postHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  listenMini: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postTitle: { fontSize: 15, fontWeight: '900' },
  postBody: { fontSize: 13, lineHeight: 19 },
  postActions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  threadBox: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 4,
    gap: 8,
  },
  replyItem: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    gap: 3,
  },
  replyComposerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
  },
  replySendBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
