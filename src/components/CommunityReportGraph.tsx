import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../i18n/native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';
import { SvgText } from '../i18n/svg';
import { TOPIC_META } from '../data/communityMockData';
import { AppTheme } from '../theme/tokens';
import { CommunityGraphEdge, CommunityGraphNode } from '../types/domain';

interface CommunityReportGraphProps {
  nodes: CommunityGraphNode[];
  edges: CommunityGraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  theme: AppTheme;
}

export const CommunityReportGraph: React.FC<CommunityReportGraphProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  theme,
}) => {
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text, fontSize: 16 * theme.scale }]}>
            Rede de Relatos (Grafo Regional)
          </Text>
          <Text style={{ fontSize: 11, color: theme.textMuted }}>
            Toque em um ponto para filtrar relatos de outros agricultores e conexões por bioma ou
            tema
          </Text>
        </View>
        {selectedNode && (
          <Pressable
            onPress={() => onSelectNode(null)}
            style={[styles.clearBtn, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: theme.text }}>Ver todos</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.svgFrame, { backgroundColor: '#F6FAF4', borderColor: theme.border }]}>
        <Svg width="100%" height={240} viewBox="0 0 320 240">
          <Rect x="0" y="0" width="320" height="240" rx="14" fill="#F6FAF4" />

          {/* Arestas do grafo */}
          {edges.map((edge) => {
            const from = nodes.find((n) => n.id === edge.fromId);
            const to = nodes.find((n) => n.id === edge.toId);
            if (!from || !to) return null;

            const isHighlighted =
              !selectedNodeId ||
              edge.fromId === selectedNodeId ||
              edge.toId === selectedNodeId;
            const strokeColor =
              edge.relation === 'mesmo_bioma'
                ? '#16A34A'
                : edge.relation === 'mesmo_tema'
                ? '#D97706'
                : '#2563EB';

            return (
              <Line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={strokeColor}
                strokeWidth={isHighlighted ? 2.2 : 1}
                strokeOpacity={isHighlighted ? 0.72 : 0.18}
                strokeDasharray={edge.relation === 'mesmo_bioma' ? undefined : '4,4'}
              />
            );
          })}

          {/* Nós do grafo */}
          {nodes.map((node) => {
            const topicInfo = TOPIC_META[node.dominantTopic];
            const isSelected = node.id === selectedNodeId;
            const baseR = node.isUserFarm ? 18 : Math.min(18, 12 + node.reportCount * 2);
            const fillColor = node.isUserFarm ? '#15803D' : topicInfo.color;
            const labelY = node.y + baseR + 12;

            const gTouchProps =
              Platform.OS === 'web'
                ? ({ onClick: () => onSelectNode(isSelected ? null : node.id) } as Record<string, unknown>)
                : { onPress: () => onSelectNode(isSelected ? null : node.id) };

            return (
              <G key={node.id} {...gTouchProps}>
                {isSelected && (
                  <Circle
                    cx={node.x}
                    cy={node.y}
                    r={baseR + 5}
                    fill="none"
                    stroke="#111827"
                    strokeWidth={2.5}
                  />
                )}
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={baseR}
                  fill={fillColor}
                  stroke="#FFFFFF"
                  strokeWidth={2.5}
                />
                <SvgText
                  x={node.x}
                  y={node.y + 4}
                  fontSize="10"
                  fontWeight="900"
                  fill="#FFFFFF"
                  textAnchor="middle"
                >
                  {node.isUserFarm ? 'EU' : String(node.reportCount)}
                </SvgText>
                <SvgText
                  x={node.x}
                  y={labelY > 232 ? node.y - baseR - 6 : labelY}
                  fontSize="9.5"
                  fontWeight="800"
                  fill="#111827"
                  textAnchor="middle"
                >
                  {node.isUserFarm
                    ? `Sua Roça (${node.estado})`
                    : `${node.municipio} (${node.estado})`}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Legenda do Grafo */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#15803D' }]} />
          <Text style={[styles.legendText, { color: theme.textMuted }]}>Sua Roça / Bioma</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#DC2626' }]} />
          <Text style={[styles.legendText, { color: theme.textMuted }]}>Seca</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#D97706' }]} />
          <Text style={[styles.legendText, { color: theme.textMuted }]}>Praga</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#16A34A' }]} />
          <Text style={[styles.legendText, { color: theme.textMuted }]}>Rotação</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#7C3AED' }]} />
          <Text style={[styles.legendText, { color: theme.textMuted }]}>Solo</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#2563EB' }]} />
          <Text style={[styles.legendText, { color: theme.textMuted }]}>Dúvida</Text>
        </View>
      </View>

      {/* Chips rápidos dos polos para acessibilidade por toque */}
      <View style={styles.nodeChipsRow}>
        {nodes.map((node) => {
          const active = node.id === selectedNodeId;
          const color = node.isUserFarm
            ? '#15803D'
            : TOPIC_META[node.dominantTopic].color;
          return (
            <Pressable
              key={`chip-${node.id}`}
              onPress={() => onSelectNode(active ? null : node.id)}
              style={[
                styles.nodeChip,
                {
                  backgroundColor: active ? color : theme.surfaceMuted,
                  borderColor: color,
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
                {node.isUserFarm ? 'Minha Região' : node.municipio} ({node.reportCount})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedNode && (
        <View
          style={[
            styles.selectedCard,
            { backgroundColor: theme.bg, borderColor: theme.primary },
          ]}
        >
          <Ionicons name="git-network-outline" size={18} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: theme.text }}>
              {selectedNode.municipio} - {selectedNode.estado} ({selectedNode.regiaoNome})
            </Text>
            <Text style={{ fontSize: 11, color: theme.textMuted }}>
              Bioma {selectedNode.bioma} •{' '}
              {selectedNode.distanceKm === 0
                ? 'Sua localização'
                : `~${selectedNode.distanceKm} km da sua roça`}{' '}
              • {selectedNode.reportCount} relato(s)
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 2, padding: 14, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { fontWeight: '900' },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  svgFrame: {
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 10.5, fontWeight: '700' },
  nodeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  nodeChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  selectedCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
